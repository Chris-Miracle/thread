import type { createThreadActions } from '~/domain/threadActions'
import { optionalString } from '~/webmcp/toolInput'
import { optionalProfileProperties, parseProfileFields } from '~/webmcp/tools/setupProfile'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function updateProfileTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'update_profile',
    title: 'Update THREAD profile',
    description: 'Incrementally update saved browser-local shopping preferences without replacing omitted fields. Use only preferences the user supplied or approved.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ...optionalProfileProperties,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      if (!Object.keys(input).length) throw new Error('Provide at least one profile field to update.')
      const profile = actions.updateProfile({
        name: optionalString(input, 'name'),
        ...parseProfileFields(input),
      })
      return { profile, nextAction: 'start_shopping_search' }
    },
  }
}
