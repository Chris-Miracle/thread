import type { createThreadActions } from '~/domain/threadActions'
import { OCCASIONS, PRODUCT_CATEGORIES } from '~/types/thread'
import { optionalCategory, optionalNumber, optionalOccasion, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function searchProductsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'search_products',
    title: 'Search Thread products',
    description: "Search Thread's verified local catalog using the saved style and shopping department. A new search replaces the shared visible list; the human can filter the results while the agent works. For live-web research, use begin_retailer_search then publish_products.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "The user's shopping request in natural language." },
        occasion: { type: 'string', description: 'Optional occasion to dress for.', enum: OCCASIONS },
        category: { type: 'string', description: 'Optional product category to restrict results to.', enum: PRODUCT_CATEGORIES },
        maxPrice: { type: 'number', description: 'Optional maximum price per product in CAD.', minimum: 0.01 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const results = await actions.searchProducts({
        query: requiredString(input, 'query'),
        occasion: optionalOccasion(input),
        category: optionalCategory(input),
        maxPrice: optionalNumber(input, 'maxPrice'),
      }, 'agent')
      return { count: results.length, results: results.slice(0, 8).map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        retailer: product.retailer,
        url: product.url,
        colors: product.colors,
        sizes: product.sizes,
        styleTags: product.styleTags,
        occasionTags: product.occasionTags,
      })) }
    },
  }
}
