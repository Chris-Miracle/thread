import type { createThreadActions } from '~/domain/threadActions'
import { optionalString, requiredString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function addToCartTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'add_to_cart',
    title: 'Add product to Thread',
    description: "Add a curated or agent-published product to the shared browser-local cart. Use the exact Thread product ID and an available size or colour. The visible cart updates immediately and exact variant duplicates are prevented.",
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Exact Thread ID returned by a product tool.' },
        size: { type: 'string', description: 'Optional available product size.' },
        color: { type: 'string', description: 'Optional available product colour.' },
      },
      required: ['productId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      const result = actions.addToCart(requiredString(input, 'productId'), {
        size: optionalString(input, 'size'),
        color: optionalString(input, 'color'),
      }, 'agent')
      return {
        success: result.success,
        duplicate: result.duplicate,
        itemId: result.item.id,
        product: compactProduct(result.item.product),
        selectedSize: result.item.size,
        selectedColor: result.item.color,
        cartCount: result.cartCount,
        totals: result.totals,
      }
    },
  }
}
