import type { createThreadActions } from '~/domain/threadActions'
import { optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function researchAgainTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'research_again',
    title: 'Research fresh alternatives again',
    description: 'Start another research pass from an accepted mission. Omit productIds to refresh the whole recommendation set, or provide presented product IDs to refresh only those needs. Previously shown product families are excluded.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        productIds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      },
      required: ['searchId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      return actions.researchAgain({
        searchId: requiredString(input, 'searchId'),
        productIds: optionalStringArray(input, 'productIds'),
      })
    },
  }
}
