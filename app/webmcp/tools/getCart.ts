import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'
import { compactCart } from '~/webmcp/toolOutput'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getCartTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_cart',
    title: 'Get current Thread',
    description: "Read the exact shared cross-store cart visible to the human, including selected variants, CAD subtotal, unpriced count, and canonical retailer checkout links.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      return compactCart(actions.getCart())
    },
  }
}
