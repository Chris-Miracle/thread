import type { createThreadActions } from '~/domain/threadActions'
import { optionalInteger, optionalString, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function claimSearchTargetsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'claim_search_targets',
    title: 'Claim retailer research targets',
    description: 'Claim a bounded batch of queued research targets, dynamically reprioritized around required mission needs that are still unfulfilled. Shop catalogue targets (sourceType "catalog") come first: call Rove search_shop_catalog for each requestIndex; the built-in anonymous HTTP connection needs no agent installation. Inspect real results and publish with shop provenance. Zero matches are no-results; actual connection failures are failed with the returned reason. Do not infer unavailability from missing agent tools. For retailer and discovery targets, open the returned need-specific search URLs and publish listing-page candidates. Resolve each target before claiming more.',
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
