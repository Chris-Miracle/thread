import type { createThreadActions } from '~/domain/threadActions'
import {
  OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type ProductEnrichmentInput,
} from '~/types/thread'
import { optionalNumber, optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export function enrichProductTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'enrich_product',
    title: 'Enrich a product candidate',
    description: 'Hydrate one candidate after detailed inspection or user interest. Use the canonical product page to add variants, availability, material, description, tags, and any price details needed before cart selection.',
    inputSchema: {
      type: 'object',
      properties: {
        searchId: { type: 'string' },
        productId: { type: 'string' },
        name: { type: 'string' },
        brand: { type: 'string' },
        nativePrice: { type: 'number', minimum: 0.01 },
        nativeCurrency: { type: 'string' },
        priceCad: { type: 'number', minimum: 0.01 },
        image: { type: 'string' },
        imageWidth: { type: 'number', minimum: 1 },
        imageHeight: { type: 'number', minimum: 1 },
        category: { type: 'string', enum: PRODUCT_CATEGORIES },
        shoppingDepartment: { type: 'string', enum: SHOPPING_DEPARTMENTS.map(option => option.id) },
        colors: { type: 'array', items: { type: 'string' }, maxItems: 24 },
        sizes: { type: 'array', items: { type: 'string' }, maxItems: 24 },
        styleTags: { type: 'array', items: { type: 'string', enum: STYLE_OPTIONS.map(option => option.id) }, maxItems: 8 },
        occasionTags: { type: 'array', items: { type: 'string', enum: OCCASIONS }, maxItems: 8 },
        description: { type: 'string' },
        material: { type: 'string' },
        availability: { type: 'string', enum: PRODUCT_AVAILABILITY },
      },
      required: ['searchId', 'productId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      const enrichment: ProductEnrichmentInput = {
        productId: requiredString(input, 'productId'),
        name: optionalString(input, 'name'),
        brand: optionalString(input, 'brand'),
        nativePrice: optionalNumber(input, 'nativePrice'),
        nativeCurrency: optionalString(input, 'nativeCurrency'),
        priceCad: optionalNumber(input, 'priceCad'),
        image: optionalString(input, 'image'),
        imageWidth: optionalNumber(input, 'imageWidth'),
        imageHeight: optionalNumber(input, 'imageHeight'),
        category: optionalString(input, 'category') as ProductEnrichmentInput['category'],
        shoppingDepartment: optionalString(input, 'shoppingDepartment') as ProductEnrichmentInput['shoppingDepartment'],
        colors: optionalStringArray(input, 'colors'),
        sizes: optionalStringArray(input, 'sizes'),
        styleTags: optionalStringArray(input, 'styleTags') as ProductEnrichmentInput['styleTags'],
        occasionTags: optionalStringArray(input, 'occasionTags') as ProductEnrichmentInput['occasionTags'],
        description: optionalString(input, 'description'),
        material: optionalString(input, 'material'),
        availability: optionalString(input, 'availability') as ProductEnrichmentInput['availability'],
      }
      return {
        product: compactProduct(actions.enrichProduct(requiredString(input, 'searchId'), enrichment)),
        nextAction: 'add_to_cart',
      }
    },
  }
}
