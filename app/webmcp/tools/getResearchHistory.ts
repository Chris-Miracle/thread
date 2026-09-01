import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getResearchHistoryTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_research_history',
    title: 'Get saved research history',
    description: 'Read locally saved completed mission prompts and their final accepted product collections, plus compact style cues and the count of product families excluded from future research. Replacement chains are saved as one merged root mission, not disconnected partial missions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      return actions.getResearchHistory()
    },
  }
}
