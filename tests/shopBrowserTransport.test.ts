import { afterEach, describe, expect, it, vi } from 'vitest'
import { createShopClient, SHOP_ENDPOINT, SHOP_PROTOCOL } from '../app/domain/research/shopClient'
import { searchShopCatalogTool } from '../app/webmcp/tools/searchShopCatalog'
import { inspectShopProductTool } from '../app/webmcp/tools/inspectShopProduct'
import { makeActions } from './helpers'

const contracts = ['search_catalog', 'get_product'].map(name => ({ name, inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }))
function transport(result: unknown = { structuredContent: { products: [], messages: [{ message: 'No matching offers' }] } }) {
  return vi.fn<typeof fetch>(async (_url, options) => {
    const request = JSON.parse(String(options?.body))
    const payload = request.method === 'server/discover' ? { supportedVersions: [SHOP_PROTOCOL] }
      : request.method === 'tools/list' ? { tools: contracts } : result
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: payload }), { headers: { 'Content-Type': 'application/json' } })
  })
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('browser-native anonymous Shop', () => {
  it('discovers once and preserves exact request, options, prices, URLs and all merchant messages without cookies or tokens', async () => {
    const evidence = { structuredContent: { products: [{ id: 'gid://shopify/p/123', variants: [{ url: 'https://merchant.test/products/shirt?variant=123&_gsid=keep', options: [{ name: 'Size', label: 'Large' }], price: { amount: 8900, currency: 'CAD' } }] }], messages: [{ message: 'Merchant disclosure' }] } }
    const fetcher = transport(evidence)
    const client = createShopClient(fetcher)
    const args = { catalog: { query: 'shirt', filters: { shops: ['zara.com'] } } }
    expect((await client.call('search_catalog', args)).result).toEqual(evidence)
    await client.call('get_product', { catalog: { id: 'gid://shopify/p/123' } })
    expect(fetcher).toHaveBeenCalledTimes(4)
    const [url, options] = fetcher.mock.calls[2]!
    expect(url).toBe(SHOP_ENDPOINT)
    expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Mcp-Method': 'tools/call', 'Mcp-Name': 'search_catalog' } })
    expect(JSON.parse(String(options!.body)).params.arguments).toEqual(args)
    expect(JSON.stringify(options!.headers).toLowerCase()).not.toContain('authorization')
  })

  it('runs a claimed mission with no external agent Shop tool and distinguishes empty offers from failure', async () => {
    const { actions } = makeActions()
    const started = actions.startShoppingSearch({ rawPrompt: 'Find a shirt from Zara under $90 CAD' })
    const target = actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const fetcher = transport()
    const tool = searchShopCatalogTool(actions, createShopClient(fetcher))
    const output = await tool.execute({ searchId: started.searchId, targetId: target.id, requestIndex: 0 }) as any
    expect(output.result.structuredContent.products).toEqual([])
    expect(output.nextAction).toBe('inspect_and_publish')
    expect(output.status).toBeUndefined()
    expect(output.request).toEqual(target.catalogRequests![0]!.arguments)
    expect(() => structuredClone(output)).not.toThrow()
    await expect(tool.execute({ searchId: started.searchId, targetId: target.id, requestIndex: -1 })).rejects.toThrow('requestIndex')
    await expect(tool.execute({ searchId: started.searchId, targetId: 'target:zara' })).rejects.toThrow('Claim')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it.each([401, 403, 429, 503])('returns real HTTP %s failure and permits a fresh connection attempt', async status => {
    const fetcher = transport()
    fetcher.mockResolvedValueOnce(new Response('failed', { status }))
    const client = createShopClient(fetcher)
    await expect(client.call('search_catalog', { catalog: { query: 'shirt' } })).rejects.toMatchObject({ code: `http:${status}`, retryable: status === 429 || status === 503 })
    await expect(client.call('search_catalog', { catalog: { query: 'shirt' } })).resolves.toMatchObject({ provider: 'shop' })
  })

  it('handles SSE, JSON-RPC errors and tool-level errors without fabricating results', async () => {
    const fetcher = transport()
    const client = createShopClient(fetcher)
    await client.call('search_catalog', { catalog: { query: 'shirt' } })
    fetcher.mockResolvedValueOnce(new Response('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"products":[]}}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }))
    expect((await client.call('search_catalog', {})).result).toEqual({ structuredContent: { products: [] } })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, error: { message: 'Unsupported filter' } })))
    await expect(client.call('search_catalog', {})).rejects.toThrow('Unsupported filter')
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, result: { isError: true, content: [{ text: 'Actual tool failure' }] } })))
    await expect(client.call('search_catalog', {})).rejects.toThrow('Actual tool failure')
  })

  it('rejects protocol drift and exposes only catalogue reads', async () => {
    const fetcher = transport()
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, result: { supportedVersions: ['unsupported'] } })))
    const client = createShopClient(fetcher)
    await expect(client.call('search_catalog', {})).rejects.toMatchObject({ code: 'protocol' })
    await expect(client.call('complete_checkout' as any, {})).rejects.toThrow('Only anonymous')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('times out a hung network request and returns a traceable fallback error', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const { actions } = makeActions()
    const started = actions.startShoppingSearch({ rawPrompt: 'Find a shirt' })
    const target = actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const pending = searchShopCatalogTool(actions, createShopClient(fetcher)).execute({ searchId: started.searchId, targetId: target.id })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await pending).toMatchObject({ status: 'failed', error: { code: 'timeout', retryable: true }, nextAction: 'retailer_fallback' })
  })

  it('verifies a published product through the same transport with the exact requested choices', async () => {
    const { actions } = makeActions()
    const started = actions.startShoppingSearch({ rawPrompt: 'Find a shirt' })
    const target = actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const product = actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [{ name: 'Cotton shirt', url: 'https://merchant.test/products/shirt', image: 'https://merchant.test/shirt.jpg', category: 'tops', shoppingDepartment: 'women', shop: { productId: 'gid://shopify/p/123', sellerDomain: 'merchant.myshopify.com', price: { amount: 5000, currency: 'CAD' }, available: true } }] }).accepted[0]!
    const fetcher = transport()
    const options = [{ name: 'Size', label: 'Large' }]
    const output = await inspectShopProductTool(actions, createShopClient(fetcher)).execute({ searchId: started.searchId, productId: product.id, requestedOptions: options }) as any
    expect(output.nextAction).toBe('inspect_and_enrich')
    const sent = JSON.parse(String(fetcher.mock.calls[2]![1]!.body))
    expect(sent.params).toMatchObject({ name: 'get_product', arguments: { catalog: { id: 'gid://shopify/p/123', selected: options } } })
  })
})
