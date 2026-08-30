import type { createThreadActions } from '~/domain/threadActions'
import { requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>
const statuses = ['queued', 'exploring', 'complete', 'no-results', 'error'] as const

export function reportResearchTargetTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'report_research_target',
    title: 'Report retailer research progress',
    description: 'Update one target in the live shared research plan so the human and other agent workers can see which stores are queued, active, complete, empty, or failed.',
    inputSchema: { type: 'object', properties: { searchId: { type: 'string' }, targetId: { type: 'string' }, status: { type: 'string', enum: statuses }, note: { type: 'string' } }, required: ['searchId', 'targetId', 'status'], additionalProperties: false },
    annotations: { readOnlyHint: false },
    execute(input) {
      const status = requiredString(input, 'status')
      if (!(statuses as readonly string[]).includes(status)) throw new Error(`status must be one of: ${statuses.join(', ')}`)
      return actions.reportResearchTarget({ searchId: requiredString(input, 'searchId'), targetId: requiredString(input, 'targetId'), status: status as typeof statuses[number], note: typeof input.note === 'string' ? input.note : undefined })
    },
  }
}
