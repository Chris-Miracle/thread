import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getProfileTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_profile',
    title: 'Get THREAD profile',
    description: 'Read the browser-local shopping profile before starting a mission. Returns saved department, styles, optional self-described identity, measurements, sizes, fit, colours, budget, and retailer preferences.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute() {
      return { profile: actions.getProfile(), nextAction: actions.getProfile() ? 'start_shopping_search' : 'setup_profile' }
    },
  }
}
