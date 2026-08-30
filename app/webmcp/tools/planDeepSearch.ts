import type { createThreadActions } from '~/domain/threadActions'
import { OCCASIONS, PRODUCT_CATEGORIES } from '~/types/thread'
import { optionalCategory, optionalNumber, optionalOccasion, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function planDeepSearchTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'plan_deep_search',
    title: 'Plan deep multi-store research',
    description: 'Create an exhaustive, collision-safe research plan for the shopping request. Returns canonical search URLs for every relevant retailer plus Pinterest and Google Shopping discovery. The calling agent should open these URLs in its own tabs or delegated browser workers; WebMCP cannot itself grant browser control. Specific retailer names in the query automatically narrow the plan.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "The user's complete shopping request, including any named stores." },
        occasion: { type: 'string', enum: OCCASIONS },
        category: { type: 'string', enum: PRODUCT_CATEGORIES },
        maxPrice: { type: 'number', minimum: 0.01 },
        retailerIds: { type: 'array', description: 'Optional exact retailer IDs from get_retailers.', items: { type: 'string' }, maxItems: 40 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      const result = actions.beginAgentSearch({
        query: requiredString(input, 'query'),
        occasion: optionalOccasion(input),
        category: optionalCategory(input),
        maxPrice: optionalNumber(input, 'maxPrice'),
        retailerIds: optionalStringArray(input, 'retailerIds'),
      }, 'deep')
      return {
        searchId: result.searchId,
        query: result.query,
        profile: result.profile,
        targetCount: result.targets.length,
        targets: result.targets,
        workflow: [
          'Open multiple target URLs in agent-controlled tabs or delegated browser workers.',
          'Inspect listing and canonical product pages deeply, including pagination where useful.',
          'Call report_research_target with exploring when a target starts.',
          'Call publish_products repeatedly; batches accumulate and never replace prior stores.',
          'Call report_research_target with complete or no-results for every target.',
          'Call finish_retailer_search only after the full research pass.',
        ],
      }
    },
  }
}
