import type { createThreadActions } from '~/domain/threadActions'
import { optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function addInspirationTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'add_inspiration',
    title: 'Pin inspiration to the board',
    description: 'Add one Pinterest pin to the shared inspiration board the human sees. Use the pin’s direct HTTPS image URL and its pin URL. While working a claimed Pinterest target, pass searchId and targetId so the pin counts toward that target. Pins become visual "Shop this look" searches through find_similar.',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'Direct HTTPS image URL of the pin.' },
        sourceUrl: { type: 'string', description: 'The Pinterest pin URL.' },
        note: { type: 'string', description: 'A short description of the look, used as a text fallback.' },
        searchId: { type: 'string' },
        targetId: { type: 'string', description: 'The claimed discovery:pinterest target.' },
        needIds: { type: 'array', items: { type: 'string' }, maxItems: 12 },
      },
      required: ['imageUrl', 'sourceUrl'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const item = actions.addInspiration({
        source: 'pinterest',
        imageUrl: requiredString(input, 'imageUrl'),
        sourceUrl: requiredString(input, 'sourceUrl'),
        note: optionalString(input, 'note'),
        searchId: optionalString(input, 'searchId'),
        targetId: optionalString(input, 'targetId'),
        needIds: optionalStringArray(input, 'needIds'),
      }, 'agent')
      return { inspiration: item, nextAction: 'find_similar' }
    },
  }
}
