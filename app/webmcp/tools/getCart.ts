import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'
import { compactCart } from '~/webmcp/toolOutput'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getCartTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_cart',
    title: 'Get current Thread',
    description: "Read the user's current cross-store cart, including products, selected variants, item count, and separate subtotals by currency. It is the exact cart visible to the human.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute() {
      return compactCart(actions.getCart())
    },
  }
}
