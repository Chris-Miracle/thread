import type { createThreadActions } from '~/domain/threadActions'
import { PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, type ProductCandidateInput } from '~/types/thread'
import { optionalNumber, optionalString, optionalStringArray, requiredArray, requiredString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

function parseCandidates(input: Record<string, unknown>): ProductCandidateInput[] {
  return requiredArray(input, 'candidates').map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`candidates[${index}] must be an object.`)
    const candidate = value as Record<string, unknown>
    return {
      url: requiredString(candidate, 'url'),
      name: requiredString(candidate, 'name'),
      retailer: optionalString(candidate, 'retailer'),
      brand: optionalString(candidate, 'brand'),
      nativePrice: optionalNumber(candidate, 'nativePrice'),
      nativeCurrency: optionalString(candidate, 'nativeCurrency'),
      priceCad: optionalNumber(candidate, 'priceCad'),
      image: requiredString(candidate, 'image'),
      imageWidth: optionalNumber(candidate, 'imageWidth'),
      imageHeight: optionalNumber(candidate, 'imageHeight'),
      category: optionalString(candidate, 'category') as ProductCandidateInput['category'],
      shoppingDepartment: optionalString(candidate, 'shoppingDepartment') as ProductCandidateInput['shoppingDepartment'],
      needIds: optionalStringArray(candidate, 'needIds'),
    }
  })
}

export function publishCandidatesTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'publish_candidates',
    title: 'Publish product candidates',
    description: 'Publish multiple products observed on a claimed retailer listing. Every candidate must include its canonical product page URL, name, and a direct HTTP(S) product image URL so recommendations are never published without imagery. THREAD derives canonical identity, retailer, source, and timestamp, then enforces target-domain, mission, department, category, retailer, budget, and CAD rules.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        targetId: { type: 'string' },
        candidates: {
          type: 'array',
          minItems: 1,
          maxItems: 40,
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              name: { type: 'string' },
              retailer: { type: 'string', description: 'Used only for unknown retailers found through discovery; known identity is derived from the domain.' },
              brand: { type: 'string' },
              nativePrice: { type: 'number', minimum: 0.01 },
              nativeCurrency: { type: 'string' },
              priceCad: { type: 'number', description: 'Required for non-CAD listings and budget-constrained missions.', minimum: 0.01 },
              image: { type: 'string', description: 'Required direct HTTP(S) URL for the product image observed on the retailer page. Do not use the product page URL, a search result, or a placeholder.' },
              imageWidth: { type: 'number', minimum: 1 },
              imageHeight: { type: 'number', minimum: 1 },
              category: { type: 'string', enum: PRODUCT_CATEGORIES },
              shoppingDepartment: { type: 'string', enum: SHOPPING_DEPARTMENTS.map(option => option.id) },
              needIds: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'Mission need IDs this observed product can fulfill. IDs must be present on the claimed target.' },
            },
            required: ['url', 'name', 'image'],
            additionalProperties: false,
          },
        },
      },
      required: ['searchId', 'targetId', 'candidates'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const result = actions.publishCandidates({
        searchId: requiredString(input, 'searchId'),
        targetId: requiredString(input, 'targetId'),
        candidates: parseCandidates(input),
      })
      return {
        ...result,
        accepted: result.accepted.map(compactProduct),
      }
    },
  }
}
