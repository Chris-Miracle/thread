/** Anonymous, read-only Shop transport. No account token, cookies or checkout operations enter Rove. */
export const SHOP_ENDPOINT = 'https://mcp.shop.com/'
export const SHOP_PROTOCOL = '2026-07-28'
export const SHOP_GUIDE = 'https://shop.com/skill.md'
type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Shop returned an invalid response.')
  return value as RecordValue
}

export class ShopRequestError extends Error {
  constructor(message: string, readonly code: string, readonly retryable = false) { super(message) }
}

export function createShopClient(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let discovery: Promise<void> | undefined
  let expiresAt = 0

  async function rpc(method: string, params: RecordValue = {}, name?: string): Promise<RecordValue> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetcher(SHOP_ENDPOINT, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': SHOP_PROTOCOL, 'Mcp-Method': method, ...(name ? { 'Mcp-Name': name } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: {
          'io.modelcontextprotocol/protocolVersion': SHOP_PROTOCOL,
          'io.modelcontextprotocol/clientInfo': { name: 'rove-web', version: '1.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        } } }),
      })
      if (!response.ok) throw new ShopRequestError(
        response.status === 401 ? 'Shop requires sign-in for this request. Anonymous discovery did not succeed.' : `Shop returned HTTP ${response.status}.`,
        `http:${response.status}`, response.status === 429 || response.status >= 500,
      )
      const text = await response.text()
      if (text.length > 5_000_000) throw new ShopRequestError('Shop response exceeds the safe response limit.', 'response-size')
      const payloads = response.headers.get('content-type')?.includes('text/event-stream')
        ? text.split(/\r?\n\r?\n/).flatMap(event => {
          const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
          return data && data !== '[DONE]' ? [JSON.parse(data)] : []
        }) : [JSON.parse(text)]
      const envelope = record(payloads.find(value => value?.id === 1))
      if (envelope.error) throw new ShopRequestError(`Shop: ${String(record(envelope.error).message ?? 'request failed')}`, 'rpc')
      const result = record(envelope.result)
      if (result.isError === true) throw new ShopRequestError(`Shop tool failed: ${JSON.stringify(result.content ?? result.structuredContent)}`, 'tool')
      return result
    } catch (error) {
      if (error instanceof ShopRequestError) throw error
      if (controller.signal.aborted) throw new ShopRequestError('Shop request timed out after 30 seconds.', 'timeout', true)
      if (error instanceof SyntaxError) throw new ShopRequestError('Shop returned malformed JSON.', 'invalid-response')
      throw new ShopRequestError(`Shop connection failed: ${error instanceof Error ? error.message : String(error)}`, 'transport', true)
    } finally { clearTimeout(timeout) }
  }

  async function connect(): Promise<void> {
    if (discovery && Date.now() < expiresAt) return discovery
    expiresAt = Date.now() + 5 * 60_000
    discovery = (async () => {
      const server = await rpc('server/discover')
      if (!Array.isArray(server.supportedVersions) || !server.supportedVersions.includes(SHOP_PROTOCOL)) {
        throw new ShopRequestError('Shop does not support the configured protocol version.', 'protocol')
      }
      const listed = await rpc('tools/list')
      const tools = Array.isArray(listed.tools) ? listed.tools : []
      for (const name of ['search_catalog', 'get_product']) {
        const tool = tools.find(value => record(value).name === name)
        if (!tool || record(record(tool).annotations).readOnlyHint !== true || !record(tool).inputSchema) {
          throw new ShopRequestError(`Shop did not advertise the read-only ${name} contract.`, 'contract')
        }
      }
    })().catch(error => { discovery = undefined; expiresAt = 0; throw error })
    return discovery
  }

  return {
    async call(name: 'search_catalog' | 'get_product', args: RecordValue) {
      if (!['search_catalog', 'get_product'].includes(name)) throw new Error('Only anonymous Shop catalogue reads are supported.')
      await connect()
      const result = await rpc('tools/call', { name, arguments: args }, name)
      return { provider: 'shop', transport: 'browser-http', endpoint: SHOP_ENDPOINT, observedAt: new Date().toISOString(), result }
    },
  }
}
