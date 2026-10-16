import type { createThreadActions } from '~/domain/threadActions'
import { optionalString } from '~/webmcp/toolInput'
import { compactCart } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function cartProposedBasketTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'cart_proposed_basket',
    title: 'Add the accepted basket to Your Thread',
    description: 'After the person accepts the proposed basket (or it auto-accepts), add every piece to Your Thread in their saved sizes. Pieces that still need a stock check or a size choice come back in needsAction with exact Shop, browser, or person steps; run them, then call this again. It never checks out.',
    inputSchema: {
      type: 'object',
      properties: { searchId: { type: 'string', description: 'Defaults to the current mission.' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const result = actions.cartProposedBasket({ searchId: optionalString(input, 'searchId') }, 'agent')
      return { ...result, cart: compactCart(result.cart) }
    },
  }
}
