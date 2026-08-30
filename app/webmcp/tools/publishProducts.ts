import type { createThreadActions } from '~/domain/threadActions'
import { OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, SHOPPING_GENDERS, STYLE_OPTIONS } from '~/types/thread'
import type { AgentProductInput } from '~/types/thread'
import { requiredString } from '~/webmcp/toolInput'
import type { JSONSchemaNode, WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

const stringArray: JSONSchemaNode = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 24 }

export function publishProductsTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'publish_products',
    title: 'Publish verified products',
    description: 'Progressively publish products verified on canonical retailer pages into the single shared list. The human may filter or add items while publication continues. Never submit invented data, search/social links, or placeholders. Thread derives IDs from URLs and safely upserts duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string', description: 'ID returned by begin_retailer_search.' },
        query: { type: 'string', description: 'Shopping request these products answer.' },
        complete: { type: 'boolean', description: 'Legacy whole-search completion flag. Prefer false and call finish_retailer_search after all targets.' },
        targetId: { type: 'string', description: 'Optional target ID returned by plan_deep_search or begin_retailer_search.' },
        targetComplete: { type: 'boolean', description: 'Mark this target complete while keeping the overall search active.' },
        exploredRetailers: { type: 'array', description: 'Retailer names checked.', items: { type: 'string' }, maxItems: 40 },
        products: {
          type: 'array', minItems: 1, maxItems: 40, items: {
            type: 'object',
            properties: {
              name: { type: 'string' }, brand: { type: 'string' }, retailer: { type: 'string' },
              category: { type: 'string', enum: PRODUCT_CATEGORIES },
              gender: { type: 'string', enum: SHOPPING_GENDERS.map(option => option.id) },
              price: { type: 'number', minimum: 0.01 }, currency: { type: 'string' }, image: { type: 'string' }, url: { type: 'string' },
              colors: stringArray, sizes: stringArray,
              styleTags: { type: 'array', items: { type: 'string', enum: STYLE_OPTIONS.map(option => option.id) }, maxItems: 8 },
              occasionTags: { type: 'array', items: { type: 'string', enum: OCCASIONS }, maxItems: 8 },
              description: { type: 'string' }, availability: { type: 'string', enum: PRODUCT_AVAILABILITY }, observedAt: { type: 'string' },
            },
            required: ['name', 'brand', 'retailer', 'category', 'price', 'currency', 'image', 'url', 'colors', 'sizes', 'description', 'observedAt'],
            additionalProperties: false,
          },
        },
      },
      required: ['searchId', 'query', 'products'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      if (!Array.isArray(input.products)) throw new Error('products must be an array.')
      const result = actions.publishAgentProducts({
        searchId: requiredString(input, 'searchId'),
        query: requiredString(input, 'query'),
        complete: typeof input.complete === 'boolean' ? input.complete : false,
        targetId: typeof input.targetId === 'string' ? input.targetId : undefined,
        targetComplete: typeof input.targetComplete === 'boolean' ? input.targetComplete : undefined,
        exploredRetailers: Array.isArray(input.exploredRetailers) ? input.exploredRetailers.filter((value): value is string => typeof value === 'string') : [],
        products: input.products as AgentProductInput[],
      })
      return {
        searchId: result.searchId,
        accepted: result.accepted.map(product => ({ id: product.id, name: product.name, retailer: product.retailer, price: product.price, currency: product.currency })),
        rejected: result.rejected,
        visibleCount: result.visibleCount,
      }
    },
  }
}
