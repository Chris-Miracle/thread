import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getResearchHistoryTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_research_history',
    title: 'Get saved research history',
    description: 'Read locally saved accepted mission prompts and products, plus compact style cues and the count of product families excluded from future research.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      return actions.getResearchHistory()
    },
  }
}
