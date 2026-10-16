import { parseShopOptions, shopOptionsSchema } from '~/webmcp/shopOptions'
import type { createThreadActions } from '~/domain/threadActions'
import { optionalString, requiredString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function addToCartTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'add_to_cart',
    title: 'Add product to Your Thread',
    description: 'Add an enriched mission product to the shared browser-local cart. Provide a size or colour only when that product exposes the corresponding choices. Shop products require a verified exact combination; use variantId and selectedOptions for all choices including fragrance volume, belt size, width and finish. Missing or sold-out combinations are rejected. Non-Shop products retain their existing size/colour flow. Exact product-and-variant duplicates are prevented.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Exact Rove product ID returned by a product tool.' },
        size: { type: 'string', description: 'Available size when the product exposes size choices; otherwise omit.' },
        variantId: { type: 'string', description: 'Exact verified Shop variant ID. Use with selectedOptions for merchant-specific choices.' },
        selectedOptions: shopOptionsSchema,
        color: { type: 'string', description: 'Available colour when the product exposes colour choices; otherwise omit.' },
      },
      required: ['productId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const result = actions.addToCart(requiredString(input, 'productId'), {
        size: optionalString(input, 'size'),
        color: optionalString(input, 'color'),
        variantId: optionalString(input, 'variantId'),
        selectedOptions: parseShopOptions(input, 'selectedOptions'),
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
