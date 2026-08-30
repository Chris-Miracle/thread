import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getVisibleProductsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_visible_products',
    title: 'Get visible products',
    description: 'Read the single shared product list currently visible to the user. Use exact returned IDs for cart actions. Results include canonical retailer links and observed timestamps.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      const products = actions.getVisibleProducts()
      return { count: products.length, products: products.slice(0, 12).map(product => ({
        id: product.id, name: product.name, retailer: product.retailer, price: product.price, currency: product.currency,
        url: product.url, colors: product.colors, sizes: product.sizes, availability: product.availability, observedAt: product.observedAt,
      })) }
    },
  }
}
