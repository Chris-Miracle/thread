import type { createThreadActions } from '~/domain/threadActions'
import { createShopClient, ShopRequestError } from '~/domain/research/shopClient'
import { shopContext } from '~/domain/research/shopRequests'
import { requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

export function inspectShopProductTool(actions: ReturnType<typeof createThreadActions>, client = createShopClient()): WebMCPToolDefinition {
  return {
    name: 'inspect_shop_product', title: 'Verify Shop product options',
    description: 'Read exact options, price and stock of a Shop product already published in this mission, through anonymous browser HTTP. Pass requestedOptions using exact returned names and labels. Inspect the effective response for substitutions before enrich_product. Does not add to a cart or purchase.',
    inputSchema: { type: 'object', properties: {
      searchId: { type: 'string' }, productId: { type: 'string' }, requestedOptions: { type: 'array', maxItems: 6, items: { type: 'object', properties: { name: { type: 'string' }, label: { type: 'string' } }, required: ['name', 'label'], additionalProperties: false } },
    }, required: ['searchId', 'productId'], additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input) {
      const searchId = requiredString(input, 'searchId')
      const status = actions.getSearchStatus(searchId)
      const product = actions.getProductById(requiredString(input, 'productId'))
      if (!status || !product?.commerce || !status.collection.productIds.includes(product.id)) throw new Error('Use a Shop product published in this mission.')
      const raw = input.requestedOptions
      if (raw !== undefined && (!Array.isArray(raw) || raw.length > 6)) throw new Error('requestedOptions must contain at most six choices.')
      const selected = (raw ?? product.commerce.selectedOptions) as unknown[]
      const options = selected.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each choice needs a name and label.')
        return { name: requiredString(value as Record<string, unknown>, 'name'), label: requiredString(value as Record<string, unknown>, 'label') }
      })
      try {
        return { searchId, productId: product.id, requestedOptions: options,
          ...await client.call('get_product', { catalog: { id: product.commerce.productId, selected: options, context: shopContext(actions.getProfile(), status.mission) } }), nextAction: 'inspect_and_enrich' }
      } catch (error) {
        if (!(error instanceof ShopRequestError)) throw error
        return { searchId, productId: product.id, status: 'failed', error: { code: error.code, message: error.message, retryable: error.retryable }, nextAction: 'retailer_fallback' }
      }
    },
  }
}
