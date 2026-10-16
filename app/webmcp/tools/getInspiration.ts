import type { createThreadActions } from '~/domain/threadActions'
import { imageLikeEntry } from '~/domain/research/shopRequests'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function getInspirationTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'get_inspiration',
    title: 'Get the inspiration board',
    description: 'Read the shared inspiration board. Uploaded photos include a ready Shop `like` image entry; pins include their image URL, whose bytes you fetch for a Shop `like` search.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      return {
        items: actions.getInspiration().map(({ imageData, ...item }) => ({
          ...item,
          like: imageData ? imageLikeEntry(imageData) : undefined,
        })),
      }
    },
  }
}
