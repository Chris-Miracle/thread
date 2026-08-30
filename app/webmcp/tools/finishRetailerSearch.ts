import type { createThreadActions } from '~/domain/threadActions'
import { requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>
export function finishRetailerSearchTool(actions: ThreadActions): WebMCPToolDefinition {
  return { name: 'finish_retailer_search', title: 'Finish deep retailer search', description: 'Finish the overall research pass only after all targets were checked. If any target remains queued or exploring, the search stays active and those targets are returned so shallow completion cannot be hidden.', inputSchema: { type: 'object', properties: { searchId: { type: 'string' } }, required: ['searchId'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input) { return actions.finishAgentSearch(requiredString(input, 'searchId')) } }
}
