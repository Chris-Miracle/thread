import type { createThreadActions } from '~/domain/threadActions'
import { optionalString, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function completeSearchTargetTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'complete_search_target',
    title: 'Resolve a research target',
    description: 'Resolve one claimed retailer as complete, no-results, or failed. Complete requires an accepted product; no-results and failed require a reason. When the mission ends with products, Rove starts a timed recommendation review before saving the result.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        targetId: { type: 'string' },
        status: { type: 'string', enum: ['complete', 'no-results', 'failed'] },
        note: { type: 'string' },
      },
      required: ['searchId', 'targetId', 'status'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      const status = requiredString(input, 'status')
      if (!['complete', 'no-results', 'failed'].includes(status)) throw new Error('status must be complete, no-results, or failed.')
      return actions.completeSearchTarget({
        searchId: requiredString(input, 'searchId'),
        targetId: requiredString(input, 'targetId'),
        status: status as 'complete' | 'no-results' | 'failed',
        note: optionalString(input, 'note'),
      })
    },
  }
}
