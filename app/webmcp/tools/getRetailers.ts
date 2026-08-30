import type { createThreadActions } from '~/domain/threadActions'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getRetailersTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_retailers',
    title: 'Get searchable retailers',
    description: "List Thread's retailer directory with official domains and shopping departments. Use it to plan broad fashion research across relevant stores.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute() {
      return actions.getRetailers().map(retailer => ({
        id: retailer.id,
        name: retailer.name,
        domain: retailer.domain,
        departments: retailer.departments,
      }))
    },
  }
}
