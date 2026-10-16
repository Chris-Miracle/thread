import type { createThreadActions } from '~/domain/threadActions'
import { PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, type ProductCandidateInput } from '~/types/thread'
import { optionalBoolean, optionalNumber, optionalRecord, optionalString, optionalStringArray, requiredArray, requiredString } from '~/webmcp/toolInput'
import { compactProduct } from '~/webmcp/toolOutput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

function parseShop(candidate: Record<string, unknown>): ProductCandidateInput['shop'] {
  const shop = optionalRecord(candidate, 'shop')
  if (!shop) return undefined
  const price = optionalRecord(shop, 'price')
  const selectedOptions = shop.selectedOptions === undefined ? undefined : requiredArray(shop, 'selectedOptions').map((option, index) => {
    if (typeof option !== 'object' || option === null || Array.isArray(option)) throw new Error(`shop.selectedOptions[${index}] must be an object.`)
    const entry = option as Record<string, unknown>
    return { name: requiredString(entry, 'name'), label: requiredString(entry, 'label') }
  })
  const options = shop.options === undefined ? undefined : requiredArray(shop, 'options').map((option, index) => {
    if (typeof option !== 'object' || option === null || Array.isArray(option)) throw new Error(`shop.options[${index}] must be an object.`)
    const entry = option as Record<string, unknown>
    return {
      name: requiredString(entry, 'name'),
      values: requiredArray(entry, 'values').map((value, valueIndex) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`shop.options[${index}].values[${valueIndex}] must be an object.`)
        const item = value as Record<string, unknown>
        return { label: requiredString(item, 'label'), available: optionalBoolean(item, 'available') }
      }),
    }
  })
  return {
    productId: requiredString(shop, 'productId'),
    variantId: optionalString(shop, 'variantId'),
    sellerDomain: requiredString(shop, 'sellerDomain'),
    sellerId: optionalString(shop, 'sellerId'),
    sellerName: optionalString(shop, 'sellerName'),
    sellerUrl: optionalString(shop, 'sellerUrl'),
    price: price ? { amount: price.amount as number, currency: requiredString(price, 'currency') } : undefined,
    available: optionalBoolean(shop, 'available'),
    selectedOptions,
    options,
    checkoutUrl: optionalString(shop, 'checkoutUrl'),
  }
}

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
      sizes: optionalStringArray(candidate, 'sizes'),
      colors: optionalStringArray(candidate, 'colors'),
      shop: parseShop(candidate),
    }
  })
}

export function publishCandidatesTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'publish_candidates',
    title: 'Publish product candidates',
    description: 'Publish multiple products observed on a claimed retailer listing, or returned by Shop search_catalog for a claimed Shop catalogue target. For Shop results, set url to the featured variant url exactly as returned, image to its first media url, and copy product/variant/seller IDs into shop and product.options into shop.options so every size and colour is recorded; Rove converts shop.price minor units to a decimal price itself, but never converts currency: a non-CAD shop.price is rejected unless priceCad is a CAD price the seller actually shows. Every candidate must include its canonical product page URL, name, and a direct HTTP(S) product image URL so recommendations are never published without imagery. Rove derives canonical identity, retailer, source, and timestamp, then enforces target-domain, mission, department, category, retailer, budget, and CAD rules.',
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
              sizes: { type: 'array', items: { type: 'string' }, maxItems: 60, description: 'Retailer listings: every size label the product page or listing offers, exactly as shown. Shop candidates use shop.options instead.' },
              colors: { type: 'array', items: { type: 'string' }, maxItems: 60, description: 'Retailer listings: every colour label offered, exactly as shown.' },
              shop: {
                type: 'object',
                description: 'Required for Shop catalogue targets and rejected elsewhere. Copy values unchanged from the search_catalog product and its featured variant.',
                properties: {
                  productId: { type: 'string', description: 'Returned product id, e.g. gid://shopify/p/….' },
                  checkoutUrl: { type: 'string', description: 'Copy the exact featured variant checkout_url, when returned. Never construct it.' },
                  variantId: { type: 'string', description: 'Featured variant id, e.g. gid://shopify/ProductVariant/….' },
                  sellerDomain: { type: 'string', description: 'variant.seller.domain (the myshopify domain Shop uses for carts).' },
                  sellerId: { type: 'string' },
                  sellerName: { type: 'string' },
                  sellerUrl: { type: 'string', description: 'variant.seller.url (the storefront).' },
                  price: {
                    type: 'object',
                    description: 'variant.price unchanged: integer minor units plus ISO currency.',
                    properties: { amount: { type: 'number', minimum: 1 }, currency: { type: 'string' } },
                    required: ['amount', 'currency'],
                    additionalProperties: false,
                  },
                  available: { type: 'boolean', description: 'variant.availability.available.' },
                  options: {
                    type: 'array',
                    maxItems: 12,
                    description: 'product.options names and value labels (with available/exists when returned), e.g. [{"name":"Size","values":[{"label":"S"},{"label":"M"}]}]. Records every size and colour the person can choose.',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        values: {
                          type: 'array',
                          maxItems: 60,
                          items: { type: 'object', properties: { label: { type: 'string' }, available: { type: 'boolean' }, exists: { type: 'boolean' } }, required: ['label'], additionalProperties: false },
                        },
                      },
                      required: ['name', 'values'],
                      additionalProperties: false,
                    },
                  },
                  selectedOptions: {
                    type: 'array',
                    maxItems: 6,
                    description: 'variant.options unchanged, e.g. [{"name":"Size","label":"M"}].',
                    items: {
                      type: 'object',
                      properties: { name: { type: 'string' }, label: { type: 'string' } },
                      required: ['name', 'label'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['productId', 'sellerDomain'],
                additionalProperties: false,
              },
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
