import type { createThreadActions } from '~/domain/threadActions'
import { OCCASIONS, PRODUCT_CATEGORIES } from '~/types/thread'
import { optionalCategory, optionalNumber, optionalOccasion, optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function beginRetailerSearchTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'begin_retailer_search',
    title: 'Begin live retailer search',
    description: "Start live-web retailer research and replace the previous shared result list. Returns a collision-safe search ID, style profile, and relevant retailers. Browse real product pages, then progressively call publish_products with that search ID.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "The user's complete shopping request." },
        occasion: { type: 'string', description: 'Optional occasion.', enum: OCCASIONS },
        category: { type: 'string', description: 'Optional product category.', enum: PRODUCT_CATEGORIES },
        maxPrice: { type: 'number', description: 'Optional maximum per-item price in CAD.', minimum: 0.01 },
        retailerIds: { type: 'array', description: 'Optional exact retailer IDs. If omitted, retailer names mentioned in the query are detected; otherwise all relevant stores are planned.', items: { type: 'string' }, maxItems: 40 },
        depth: { type: 'string', description: 'How many retailers to plan. Defaults to deep.', enum: ['focused', 'balanced', 'deep'] },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      const depth = optionalString(input, 'depth')
      const result = actions.beginAgentSearch({
        query: requiredString(input, 'query'),
        occasion: optionalOccasion(input),
        category: optionalCategory(input),
        maxPrice: optionalNumber(input, 'maxPrice'),
        retailerIds: optionalStringArray(input, 'retailerIds'),
      }, depth === 'focused' || depth === 'balanced' ? depth : 'deep')
      return {
        searchId: result.searchId,
        query: result.query,
        profile: result.profile,
        targetCount: result.targets.length,
        targets: result.targets,
        next: 'Open target URLs in agent-controlled tabs or delegated browser workers. Publish every verified retailer product in batches with complete false, report each target, then call finish_retailer_search once the full pass is done.',
      }
    },
  }
}
