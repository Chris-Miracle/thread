import type { createThreadActions } from '~/domain/threadActions'
import { requiredString } from '~/webmcp/toolInput'
import { compactCart } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function removeFromCartTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'remove_from_cart',
    title: 'Remove item from Your Thread',
    description: 'Remove one exact cart entry by its collision-safe item ID. Read get_cart first when the item ID is unknown. The visible human cart updates immediately.',
    inputSchema: {
      type: 'object',
      properties: { itemId: { type: 'string', description: 'Exact cart item ID returned by get_cart.' } },
      required: ['itemId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      const itemId = requiredString(input, 'itemId')
      const removed = actions.removeFromCart(itemId, 'agent')
      return { success: removed, itemId, cart: compactCart(actions.getCart()) }
    },
  }
}
