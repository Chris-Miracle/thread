import type { createThreadActions } from '~/domain/threadActions'
import { requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

export function resolveStoreTool(actions: ReturnType<typeof createThreadActions>): WebMCPToolDefinition {
  return {
    name: 'resolve_store', title: 'Resolve a requested store',
    description: 'Before claiming research, resolve an unfamiliar store named in the brief to its verified official storefront domain. Visit the official site to establish the domain; do not invent it, pass a marketplace listing, or broaden the request to other merchants. If it cannot be verified, tell the person. Rove regenerates Shop requests with a hard shops filter.',
    inputSchema: { type: 'object', properties: { searchId: { type: 'string' }, name: { type: 'string' }, domain: { type: 'string' } }, required: ['searchId', 'name', 'domain'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      return actions.resolveStore({ searchId: requiredString(input, 'searchId'), name: requiredString(input, 'name'), domain: requiredString(input, 'domain') })
    },
  }
}
