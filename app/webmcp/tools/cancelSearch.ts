import type { createThreadActions } from '~/domain/threadActions'
import { optionalString, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function cancelSearchTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'cancel_search',
    title: 'Cancel shopping research',
    description: 'Stop or explicitly abandon the active retailer pass, cancel every unresolved target, and preserve products already accepted for human review.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        reason: { type: 'string' },
        disposition: { type: 'string', enum: ['cancelled', 'abandoned'] },
      },
      required: ['searchId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const disposition = optionalString(input, 'disposition')
      if (disposition && disposition !== 'cancelled' && disposition !== 'abandoned') throw new Error('disposition must be cancelled or abandoned.')
      return actions.cancelSearch(
        requiredString(input, 'searchId'),
        optionalString(input, 'reason'),
        disposition as 'cancelled' | 'abandoned' | undefined,
      )
    },
  }
}
