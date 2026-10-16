import { parseShopOptions, shopOptionsSchema } from '~/webmcp/shopOptions'
import type { createThreadActions } from '~/domain/threadActions'
import {
  OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type ProductEnrichmentInput,
} from '~/types/thread'
import { optionalNumber, optionalRecord, optionalString, optionalStringArray, requiredArray, requiredString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

function parseVariants(input: Record<string, unknown>): ProductEnrichmentInput['variants'] {
  if (input.variants === undefined) return undefined
  return requiredArray(input, 'variants').map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`variants[${index}] must be an object.`)
    const variant = value as Record<string, unknown>
    const price = optionalRecord(variant, 'price')
    return {
      id: requiredString(variant, 'id'),
      priceCad: optionalNumber(variant, 'priceCad'),
      checkoutUrl: optionalString(variant, 'checkoutUrl'),
      url: optionalString(variant, 'url'),
      options: requiredArray(variant, 'options').map((option, optionIndex) => {
        if (typeof option !== 'object' || option === null || Array.isArray(option)) throw new Error(`variants[${index}].options[${optionIndex}] must be an object.`)
        const entry = option as Record<string, unknown>
        return { name: requiredString(entry, 'name'), label: requiredString(entry, 'label') }
      }),
      available: variant.available as boolean,
      price: price ? { amount: price.amount as number, currency: requiredString(price, 'currency') } : undefined,
    }
  })
}

export function enrichProductTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'enrich_product',
    title: 'Enrich a product candidate',
    description: 'Hydrate one candidate after detailed inspection or user interest. Use the canonical product page to add variants, availability, material, description, tags, and any price details needed before cart selection. For Shop, send shopProductId, requestedOptions (the exact requested name/label pairs), and one exact returned variant with options, availability, price and checkoutUrl when returned. Compare the effective selection: a dropped option, changed volume, or substitute body wash is a mismatch, not a valid perfume. Rove rejects mismatches. Search results may verify the featured selection without another lookup; use get_product only for unresolved facts or different options. Never infer combinations from size lists. Strip HTML from descriptions.',
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
        shopProductId: { type: 'string', description: 'Copy the returned Shop product ID. A different product is rejected.' },
        requestedOptions: { ...shopOptionsSchema, description: 'Exact options sent to Shop, including Size, Color, Width, Finish, volume or accessory size. Omit only to verify the previously published selection. Returned options must match exactly; never silently relax them.' },
        variants: {
          type: 'array',
          minItems: 1,
          maxItems: 1,
          description: 'Shop catalogue products only: exact variants copied unchanged from Shop.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'gid://shopify/ProductVariant/…' },
              options: {
                type: 'array',
                maxItems: 6,
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, label: { type: 'string' } },
                  required: ['name', 'label'],
                  additionalProperties: false,
                },
              },
              available: { type: 'boolean' },
              priceCad: { type: 'number', minimum: 0.01 },
              url: { type: 'string', description: 'The complete returned variant URL, unchanged.' },
              checkoutUrl: { type: 'string', description: 'Exact checkout_url returned for this variant; never construct one.' },
              price: {
                type: 'object',
                properties: { amount: { type: 'number', minimum: 1 }, currency: { type: 'string' } },
                required: ['amount', 'currency'],
                additionalProperties: false,
              },
            },
            required: ['id', 'options', 'available'],
            additionalProperties: false,
          },
        },
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
        variants: parseVariants(input),
        requestedOptions: parseShopOptions(input, 'requestedOptions'),
        shopProductId: optionalString(input, 'shopProductId'),
      }
      return {
        product: compactProduct(actions.enrichProduct(requiredString(input, 'searchId'), enrichment)),
        nextAction: 'add_to_cart',
      }
    },
  }
}
