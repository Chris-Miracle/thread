import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>
export function getResearchProgressTool(actions: ThreadActions): WebMCPToolDefinition {
  return { name: 'get_research_progress', title: 'Get deep-search progress', description: 'Read the shared multi-store research plan, per-target status, product counts, and search URLs.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute() { return actions.getResearchProgress() } }
}
