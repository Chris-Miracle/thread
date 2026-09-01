import type { createThreadActions } from '~/domain/threadActions'
import { optionalString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getSearchStatusTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_search_status',
    title: 'Get shopping research status',
    description: 'Read the persisted mission, full visible collection, fulfillment, retailer coverage, timed recommendation review, and next action. During selective replacement, collection shows which products remain preserved and which IDs are being replaced. Expired reviews are accepted and saved locally.',
    inputSchema: {
      type: 'object',
      properties: { searchId: { type: 'string', description: 'Optional expected active search ID.' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(input) {
      return actions.getSearchStatus(optionalString(input, 'searchId'))
    },
  }
}
