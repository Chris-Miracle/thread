import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getStyleProfileTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_style_profile',
    title: 'Get style profile',
    description: "Read the user's saved Thread profile: first name, shopping department, and style preferences. Use it before retailer research so recommendations reflect who the user shops for and their taste.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute() {
      const profile = actions.getStyleProfile()
      return { name: profile?.name ?? '', gender: profile?.gender ?? 'all', styles: profile?.styles ?? [] }
    },
  }
}
