import type { createThreadActions } from '~/domain/threadActions'
import { SHOP_LOGO, shopContext } from '~/domain/research/shopRequests'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getCheckoutPlanTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_checkout_plan',
    title: 'Get the per-store checkout plan',
    description: 'Read Your Thread grouped by seller. Shop-backed groups list exact variant IDs and quantities for one Shop cart or checkout per seller; a line without variantId carries a ready get_product request that resolves it. Create Shop carts or checkouts only when the user asks to save a cart or check out, then call attach_merchant_cart with the returned continue_url. Other stores keep their retailer links. Rove never completes a purchase.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      const plan = actions.getCheckoutPlan()
      return {
        ...plan,
        groups: plan.groups.map(group => ({
          ...group,
          shop: group.provider === 'shop' ? group.sellerDomain : undefined,
          checkoutRequest: group.provider === 'shop' && group.lines.every(line => line.variantId)
            ? { tool: 'create_checkout', arguments: { shop: group.sellerDomain, checkout: { context: shopContext(actions.getProfile()), line_items: group.lines.map(line => ({ item: { id: line.variantId }, quantity: line.quantity })) } } }
            : undefined,
          lines: group.lines.map(line => ({
            ...line,
            variantLookup: line.shopProductId && !line.variantId
              ? { tool: 'get_product', arguments: { catalog: { id: line.shopProductId, selected: line.selected, context: shopContext() } } }
              : undefined,
          })),
        })),
        source: { name: 'Shop', logo: SHOP_LOGO },
      }
    },
  }
}
