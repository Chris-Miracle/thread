import { afterEach, describe, expect, it, vi } from 'vitest'
import { createThreadToolDefinitions, registerThreadTools, THREAD_TOOL_NAMES, unregisterThreadTools } from '../app/webmcp/registerThreadTools'
import { PRODUCTS } from '../app/data/products'
import type { JSONSchemaNode } from '../app/webmcp/types'
import { makeActions } from './helpers'

function assertClosedObjects(schema: JSONSchemaNode): void {
  if (schema.type === 'object') {
    expect(schema.additionalProperties).toBe(false)
    Object.values(schema.properties ?? {}).forEach(assertClosedObjects)
  }
  if (schema.type === 'array' && schema.items) assertClosedObjects(schema.items)
}

afterEach(() => {
  unregisterThreadTools()
  Reflect.deleteProperty(document, 'modelContext')
})

describe('WebMCP mission-oriented surface', () => {
  it('registers exactly the expected non-competing tools', () => {
    const tools = createThreadToolDefinitions(makeActions().actions)
    expect(tools.map(tool => tool.name)).toEqual(THREAD_TOOL_NAMES)
    expect(tools.map(tool => tool.name)).not.toEqual(expect.arrayContaining([
      'search_products',
      'begin_retailer_search',
      'plan_deep_search',
      'publish_products',
    ]))
  })

  it('marks read-only and externally sourced outputs correctly', () => {
    const tools = createThreadToolDefinitions(makeActions().actions)
    const readOnly = tools.filter(tool => tool.annotations.readOnlyHint).map(tool => tool.name)
    expect(readOnly).toEqual(['get_profile', 'get_search_status', 'get_products', 'get_research_history', 'get_cart'])
    const untrusted = tools.filter(tool => tool.annotations.untrustedContentHint).map(tool => tool.name)
    expect(untrusted).toEqual(expect.arrayContaining([
      'claim_search_targets',
      'publish_candidates',
      'enrich_product',
      'get_search_status',
      'get_products',
      'review_recommendations',
      'research_again',
      'get_research_history',
      'cancel_search',
      'get_cart',
      'add_to_cart',
    ]))
  })

  it('uses closed JSON schemas for every tool and nested object', () => {
    const tools = createThreadToolDefinitions(makeActions().actions)
    tools.forEach(tool => assertClosedObjects(tool.inputSchema))
  })

  it('requires a product image before a candidate can be published', () => {
    const publish = createThreadToolDefinitions(makeActions().actions).find(tool => tool.name === 'publish_candidates')!
    const candidateSchema = publish.inputSchema.properties?.candidates?.items
    expect(candidateSchema?.required).toEqual(expect.arrayContaining(['url', 'name', 'image']))
    expect(() => publish.execute({
      searchId: 'search:test',
      targetId: 'target:test',
      candidates: [{ url: 'https://example.test/product', name: 'Image-less product' }],
    })).toThrow('image is required')
  })

  it('executes WebMCP mutations through the same shared action state as the UI', async () => {
    const harness = makeActions()
    const tools = createThreadToolDefinitions(harness.actions)
    const start = tools.find(tool => tool.name === 'start_shopping_search')!
    const result = await start.execute({
      rawPrompt: 'Find a black shirt under $70 CAD',
      constraints: { retailerIds: ['uniqlo'] },
    }) as { searchId: string }
    expect(harness.search.value.activeSearch?.id).toBe(result.searchId)
    expect(harness.search.value.activeSearch?.mission.constraints).toMatchObject({
      maxPriceCad: 70,
      categories: ['tops'],
      retailerIds: ['uniqlo'],
    })
  })

  it('executes every registered tool through one coherent mission without non-cloneable output', async () => {
    const harness = makeActions()
    const tools = new Map(createThreadToolDefinitions(harness.actions).map(tool => [tool.name, tool]))
    const called: string[] = []
    const execute = async (name: typeof THREAD_TOOL_NAMES[number], input: Record<string, unknown> = {}) => {
      const tool = tools.get(name)
      expect(tool, `Missing tool ${name}`).toBeDefined()
      called.push(name)
      const result = await tool!.execute(input)
      expect(() => structuredClone(result)).not.toThrow()
      return result as Record<string, any>
    }

    const shirt = PRODUCTS.find(product => product.retailerId === 'uniqlo' && product.shoppingDepartment === 'women')!
    await execute('get_profile')
    await execute('setup_profile', { name: 'Chris', shoppingDepartment: 'women' })
    await execute('update_profile', { name: 'Chris' })
    const started = await execute('start_shopping_search', {
      rawPrompt: 'Find one smart-casual shirt under $70 CAD',
      shoppingDepartment: 'women',
      needs: [{ intent: 'smart-casual shirt', queries: ['smart casual shirt'], categories: ['tops'], required: true, quantity: 1, budgetCad: 70 }],
      constraints: { maxPriceCad: 70, overallBudgetCad: 70, categories: ['tops'], retailerIds: ['uniqlo'] },
    })
    const searchId = started.searchId as string
    const claimed = await execute('claim_search_targets', { searchId, limit: 1, workerId: 'webmcp-contract' })
    const targetId = claimed.targets[0].id as string
    const published = await execute('publish_candidates', {
      searchId,
      targetId,
      candidates: [{
        url: shirt.url,
        name: shirt.name,
        brand: shirt.brand,
        nativePrice: shirt.nativePrice,
        nativeCurrency: shirt.nativeCurrency,
        priceCad: shirt.priceCad,
        image: shirt.image,
        category: shirt.category,
        shoppingDepartment: shirt.shoppingDepartment,
      }],
    })
    const productId = published.accepted[0].id as string
    await execute('enrich_product', {
      searchId,
      productId,
      colors: shirt.colors,
      sizes: shirt.sizes,
      availability: 'in-stock',
      description: shirt.description,
    })
    await execute('complete_search_target', { searchId, targetId, status: 'complete', note: 'Contract test verified the product page.' })
    await execute('get_search_status', { searchId })
    await execute('get_products', { searchId, limit: 100 })
    await execute('review_recommendations', { searchId, decision: 'accept-all' })
    await execute('get_research_history')
    const added = await execute('add_to_cart', { productId, size: shirt.sizes[0], color: shirt.colors[0] })
    await execute('get_cart')
    await execute('remove_from_cart', { itemId: added.itemId })
    const replacement = await execute('research_again', { searchId })
    await execute('cancel_search', { searchId: replacement.replacement.searchId, reason: 'Contract test complete.' })

    expect(new Set(called)).toEqual(new Set(THREAD_TOOL_NAMES))
  })

  it('normalizes irrelevant fragrance variants at the WebMCP cart boundary', async () => {
    const base = PRODUCTS.find(product => product.retailerId === 'uniqlo')!
    const fragrance = {
      ...base,
      id: 'product:webmcp:fragrance',
      name: 'Cedar Veil Eau de Parfum 100 ml',
      category: 'fragrance' as const,
      colors: ['Amber bottle'],
      sizes: ['100 ml'],
    }
    const harness = makeActions({ fixtures: [fragrance] })
    const add = createThreadToolDefinitions(harness.actions).find(tool => tool.name === 'add_to_cart')!
    const result = await add.execute({ productId: fragrance.id, size: 'XL', color: 'Green' }) as Record<string, unknown>

    expect(result).toMatchObject({ success: true, duplicate: false, selectedSize: undefined, selectedColor: undefined, cartCount: 1 })
    expect(() => structuredClone(result)).not.toThrow()
  })

  it('feature-detects, avoids duplicate registration, and tears down through AbortController', async () => {
    const registered: Array<{ name: string; signal?: AbortSignal }> = []
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: vi.fn(async (tool: { name: string }, options?: { signal?: AbortSignal }) => {
          registered.push({ name: tool.name, signal: options?.signal })
        }),
      },
    })
    const actions = makeActions().actions
    expect(await registerThreadTools(actions)).toEqual(THREAD_TOOL_NAMES)
    expect(await registerThreadTools(actions)).toEqual(THREAD_TOOL_NAMES)
    expect(registered).toHaveLength(THREAD_TOOL_NAMES.length)
    expect(registered.every(item => item.signal && !item.signal.aborted)).toBe(true)
    unregisterThreadTools()
    expect(registered.every(item => item.signal?.aborted)).toBe(true)
  })
})
