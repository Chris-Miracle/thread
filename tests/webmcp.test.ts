import { afterEach, describe, expect, it, vi } from 'vitest'
import { createThreadToolDefinitions, registerThreadTools, THREAD_TOOL_NAMES, unregisterThreadTools } from '../app/webmcp/registerThreadTools'
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
