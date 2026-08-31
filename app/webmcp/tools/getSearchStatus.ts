import type { createThreadActions } from '~/domain/threadActions'
import { optionalString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getSearchStatusTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_search_status',
    title: 'Get shopping research status',
    description: 'Read the persisted mission, fulfillment, retailer coverage, timed recommendation review, and next action. A pending review asks the user to accept all, replace selected products, or replace everything; expired reviews are accepted and saved locally.',
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
