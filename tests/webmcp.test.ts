import { afterEach, describe, expect, it, vi } from 'vitest'
import { createThreadToolDefinitions, registerThreadTools, THREAD_TOOL_NAMES, unregisterThreadTools } from '../app/webmcp/registerThreadTools'
import { PRODUCTS } from '../app/data/products'
import type { JSONSchemaNode } from '../app/webmcp/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeActions } from './helpers'

function shopFixture(name: string, key = 'products'): any {
  const parsed = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/shop', `${name}.json`), 'utf8'))
  return key === 'products' ? parsed.products : parsed[key]
}

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
    expect(readOnly).toEqual(['get_profile', 'search_shop_catalog', 'inspect_shop_product', 'get_search_status', 'get_products', 'get_research_history', 'get_cart', 'get_checkout_plan', 'get_inspiration'])
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
      'get_checkout_plan',
      'attach_merchant_cart',
      'add_inspiration',
      'get_inspiration',
      'find_similar',
      'record_purchases',
      'cart_proposed_basket',
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

    const leggings = shopFixture('search-gymshark')[0]
    const featured = leggings.variants[0]
    const medium = shopFixture('get-product', 'product').variants[0]
    for (const name of ['search_shop_catalog', 'inspect_shop_product'] as const) {
      called.push(name)
      await expect(tools.get(name)!.execute({})).rejects.toThrow('searchId')
    }
    await execute('get_profile')
    await execute('setup_profile', { name: 'Chris', shoppingDepartment: 'women' })
    await execute('update_profile', { name: 'Chris' })
    const started = await execute('start_shopping_search', {
      rawPrompt: 'Find black Gymshark leggings under $80 CAD',
      shoppingDepartment: 'women',
      needs: [{ intent: 'leggings', queries: ['black leggings'], categories: ['bottoms'], required: true, quantity: 1, budgetCad: 80 }],
      constraints: { maxPriceCad: 80, overallBudgetCad: 80, categories: ['bottoms'], retailerIds: ['gymshark'] },
    })
    const searchId = started.searchId as string
    const claimed = await execute('claim_search_targets', { searchId, limit: 1, workerId: 'webmcp-contract' })
    const target = claimed.targets[0]
    expect(target.sourceType).toBe('catalog')
    expect(target.catalogRequests[0].arguments.catalog.filters).toMatchObject({ price: { max: 8000 }, shops: ['ca.gymshark.com'] })
    const published = await execute('publish_candidates', {
      searchId,
      targetId: target.id,
      candidates: [{
        url: featured.url,
        name: leggings.title,
        image: leggings.media[0].url,
        category: 'bottoms',
        shoppingDepartment: 'women',
        shop: {
          productId: leggings.id,
          variantId: featured.id,
          sellerDomain: featured.seller.domain,
          sellerName: featured.seller.name,
          sellerUrl: featured.seller.url,
          price: featured.price,
          available: featured.availability.available,
          selectedOptions: featured.options,
        },
      }],
    })
    expect(published.rejected).toEqual([])
    const productId = published.accepted[0].id as string
    await execute('enrich_product', {
      searchId,
      productId,
      sizes: ['Small', 'Medium', 'Large'],
      availability: 'in-stock',
      requestedOptions: medium.options,
      variants: [{ id: medium.id, options: medium.options, available: medium.availability.available, price: medium.price }],
    })
    await execute('complete_search_target', { searchId, targetId: target.id, status: 'complete', note: 'Shop returned the requested leggings.' })
    // One result is not a real choice yet, so the Gymshark storefront is still queued; the agent resolves it.
    const storefront = await execute('claim_search_targets', { searchId, limit: 1 })
    await execute('complete_search_target', { searchId, targetId: storefront.targets[0].id, status: 'no-results', note: 'Storefront matched the Shop results.' })
    await execute('get_search_status', { searchId })
    await execute('get_products', { searchId, limit: 100 })
    const reviewed = await execute('review_recommendations', { searchId, decision: 'accept-all' })
    expect(reviewed.next.map((step: { tool: string }) => step.tool)).toEqual(['cart_proposed_basket', 'get_checkout_plan'])
    // No saved size yet, so the basket asks the person rather than guessing.
    const basket = await execute('cart_proposed_basket', { searchId })
    expect(basket).toMatchObject({ added: [], needsAction: [{ productId, reason: expect.stringContaining('No saved bottoms size') }] })
    expect(basket.needsAction[0].steps.map((step: { tool: string }) => step.tool)).toEqual(['choose_size', 'update_profile'])
    await execute('get_research_history')
    const added = await execute('add_to_cart', { productId, size: 'Medium' })
    const plan = await execute('get_checkout_plan')
    const group = plan.groups[0]
    expect(group).toMatchObject({ provider: 'shop', status: 'needs-cart', shop: 'gymshark-can.myshopify.com' })
    expect(group.lines[0]).toMatchObject({ variantId: medium.id, selected: [{ name: 'Size', label: 'Medium' }] })
    const attached = await execute('attach_merchant_cart', {
      groupKey: group.key,
      continueUrl: 'https://ca.checkout.gymshark.com/cart/c/contract-test?key=abc',
      total: { amount: 5000, currency: 'CAD' },
      messages: ['Shipping is calculated at checkout.'],
    })
    expect(attached.plan.groups[0].status).toBe('ready')
    const recorded = await execute('record_purchases', {
      source: 'checkout',
      purchases: [{ sellerDomain: featured.seller.domain, productUrl: featured.url, brand: 'Gymshark' }],
    })
    expect(recorded.markedOrdered).toEqual([group.key])
    await execute('get_cart')
    await execute('remove_from_cart', { itemId: added.itemId })
    const replacement = await execute('research_again', { searchId })
    const pin = await execute('add_inspiration', {
      imageUrl: 'https://i.pinimg.com/736x/aa/bb/cc/black-leggings.jpg',
      sourceUrl: 'https://www.pinterest.com/pin/123456789/',
      note: 'black seamless leggings',
    })
    expect((await execute('get_inspiration')).items).toHaveLength(1)
    const similar = await execute('find_similar', { inspirationId: pin.inspiration.id })
    expect(similar).toMatchObject({ mode: 'appended', searchId: replacement.replacement.searchId })
    await execute('cancel_search', { searchId: replacement.replacement.searchId, reason: 'Contract test complete.' })

    const storeMission = await execute('start_shopping_search', { rawPrompt: 'Find a shirt from TruClothing under $90 CAD' })
    await execute('resolve_store', { searchId: storeMission.searchId, name: 'TruClothing', domain: 'truclothing.com' })
    await execute('cancel_search', { searchId: storeMission.searchId, reason: 'Store resolution verified.' })

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
