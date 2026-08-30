import type { createThreadActions } from '~/domain/threadActions'
import { SHOPPING_GENDERS, STYLE_OPTIONS } from '~/types/thread'
import { optionalBoolean, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function setupProfileTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'setup_profile',
    title: 'Set up Thread profile',
    description: "Create a new user's browser-local Thread profile so an agent can begin shopping. Use this when get_style_profile returns no name. Name and shopping department must be known; include only styles the user stated or reliably provided, and omit styles instead of inventing them. Existing profiles are preserved unless replaceExisting is true. After setup, call search_products or begin_retailer_search to populate the shared result list.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "User's preferred first name." },
        gender: { type: 'string', description: 'Shopping department to prioritize.', enum: SHOPPING_GENDERS.map(item => item.id) },
        styles: { type: 'array', description: 'Optional known style preferences. Never guess missing preferences.', items: { type: 'string', enum: STYLE_OPTIONS.map(item => item.id) }, maxItems: 3 },
        replaceExisting: { type: 'boolean', description: 'Explicitly replace an existing profile. Defaults to false.' },
      },
      required: ['name', 'gender'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    async execute(input) {
      const result = await actions.setupProfile({
        name: requiredString(input, 'name'),
        gender: requiredString(input, 'gender'),
        styles: optionalStringArray(input, 'styles'),
        replaceExisting: optionalBoolean(input, 'replaceExisting'),
      })
      return {
        status: result.status,
        profile: result.profile,
        readyForSearch: true,
        next: 'Use search_products for grounded local matching or begin_retailer_search for live retailer research. Results appear in the single shared list.',
      }
    },
  }
}
