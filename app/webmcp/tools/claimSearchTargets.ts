import type { createThreadActions } from '~/domain/threadActions'
import { optionalInteger, optionalString, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function claimSearchTargetsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'claim_search_targets',
    title: 'Claim retailer research targets',
    description: 'Claim a bounded batch of queued retailer targets, dynamically reprioritized around required mission needs that are still unfulfilled. Open the returned need-specific search URLs, publish listing-page candidates, then resolve each target before claiming more.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        limit: { type: 'number', description: 'Batch size from 1 to 4. Defaults to 3.', minimum: 1, maximum: 4 },
        workerId: { type: 'string', description: 'Optional stable browser worker label for traceability.' },
      },
      required: ['searchId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      return actions.claimSearchTargets({
        searchId: requiredString(input, 'searchId'),
        limit: optionalInteger(input, 'limit', 1, 4),
        workerId: optionalString(input, 'workerId'),
      })
    },
  }
}
