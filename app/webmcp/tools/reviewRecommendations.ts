import type { createThreadActions } from '~/domain/threadActions'
import { optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function reviewRecommendationsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'review_recommendations',
    title: 'Review finished recommendations',
    description: 'Resolve the pending recommendation review after research finishes. Accept everything, replace selected product IDs, or replace the entire set. Selective replacement removes only those IDs, keeps every other accepted item visible in the current edit, and excludes every previously shown product link from fresh research.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        decision: { type: 'string', enum: ['accept-all', 'replace-selected', 'replace-all'] },
        rejectedProductIds: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 20,
          description: 'Required only for replace-selected. Use exact IDs returned in recommendationReview.productIds.',
        },
      },
      required: ['searchId', 'decision'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const decision = requiredString(input, 'decision')
      if (!['accept-all', 'replace-selected', 'replace-all'].includes(decision)) {
        throw new Error('decision must be accept-all, replace-selected, or replace-all.')
      }
      return actions.reviewRecommendations({
        searchId: requiredString(input, 'searchId'),
        decision: decision as 'accept-all' | 'replace-selected' | 'replace-all',
        rejectedProductIds: optionalStringArray(input, 'rejectedProductIds'),
      })
    },
  }
}
