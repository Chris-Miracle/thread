import type { createThreadActions } from '~/domain/threadActions'
import { optionalString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getSearchStatusTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_search_status',
    title: 'Get shopping research status',
    description: 'Read the persisted mission, per-need fulfillment and budget plan, honest coverage counters (including targets skipped after satisfaction), target lifecycle, and next action. Use it after refresh or whenever research progress is uncertain.',
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
