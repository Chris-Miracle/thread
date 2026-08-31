import type { createThreadActions } from '~/domain/threadActions'
import { PRODUCT_CATEGORIES, type GetProductsInput } from '~/types/thread'
import { optionalInteger, optionalString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getProductsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_products',
    title: 'Get mission products',
    description: 'Page through the current ranked and diversified product registry. Supports cursor or offset, up to 100 records, plus retailer, category, and sort filters; returned IDs are valid for enrichment and cart actions.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        cursor: { type: 'string' },
        offset: { type: 'number', minimum: 0 },
        limit: { type: 'number', minimum: 1, maximum: 100 },
        retailerId: { type: 'string' },
        category: { type: 'string', enum: PRODUCT_CATEGORIES },
        sort: { type: 'string', enum: ['recommended', 'price-asc', 'price-desc', 'newest'] },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(input) {
      const result = actions.getProducts({
        searchId: optionalString(input, 'searchId'),
        cursor: optionalString(input, 'cursor'),
        offset: optionalInteger(input, 'offset', 0),
        limit: optionalInteger(input, 'limit', 1, 100),
        retailerId: optionalString(input, 'retailerId'),
        category: optionalString(input, 'category') as GetProductsInput['category'],
        sort: optionalString(input, 'sort') as GetProductsInput['sort'],
      })
      return { ...result, products: result.products.map(compactProduct) }
    },
  }
}
