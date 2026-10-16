import type { createThreadActions } from '~/domain/threadActions'
import { optionalString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function findSimilarTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'find_similar',
    title: 'Find similar pieces',
    description: 'Search for pieces like one product ("More like this") or one inspiration image ("Shop this look"). During an active mission this adds a Shop similarity target; otherwise it starts a focused follow-up mission. Then claim targets as usual. Shop products search by product ID; images search by bytes.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Rove product ID.' },
        inspirationId: { type: 'string', description: 'Inspiration board item ID.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      return actions.findSimilar({
        productId: optionalString(input, 'productId'),
        inspirationId: optionalString(input, 'inspirationId'),
      }, 'agent')
    },
  }
}
