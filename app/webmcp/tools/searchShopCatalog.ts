import type { createThreadActions } from '~/domain/threadActions'
import { createShopClient, SHOP_GUIDE, ShopRequestError } from '~/domain/research/shopClient'
import { optionalInteger, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type Actions = ReturnType<typeof createThreadActions>

export function searchShopCatalogTool(actions: Actions, client = createShopClient()): WebMCPToolDefinition {
  return {
    name: 'search_shop_catalog', title: 'Search Shop from Rove',
    description: 'Run one exact planned Shop catalogue request directly from this browser. Works anonymously without a Shop plugin, CLI, account or local setup. First read the official Shop guide at https://shop.com/skill.md. Requires a claimed catalogue target; requestIndex defaults to zero. Returns original Shop evidence and every message; inspect sellers, exact options and currency before publishing. An empty result means no matches, not a disconnected Shop. On an actual error, use the retailer fallback with the returned reason. Never substitutes or broadens filters.',
    inputSchema: { type: 'object', properties: { searchId: { type: 'string' }, targetId: { type: 'string' }, requestIndex: { type: 'number', minimum: 0 } }, required: ['searchId', 'targetId'], additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input) {
      const searchId = requiredString(input, 'searchId')
      const targetId = requiredString(input, 'targetId')
      const index = optionalInteger(input, 'requestIndex', 0) ?? 0
      const { request, requestCount } = actions.getShopRequest(searchId, targetId, index)
      try {
        return { searchId, targetId, requestIndex: index, requestCount, request: request.arguments,
          ...await client.call('search_catalog', request.arguments), nextAction: 'inspect_and_publish', guideUrl: SHOP_GUIDE }
      } catch (error) {
        if (!(error instanceof ShopRequestError)) throw error
        return { searchId, targetId, status: 'failed', error: { code: error.code, message: error.message, retryable: error.retryable },
          nextAction: 'retailer_fallback', guideUrl: SHOP_GUIDE }
      }
    },
  }
}
