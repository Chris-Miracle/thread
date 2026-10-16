import type { createThreadActions } from '~/domain/threadActions'
import {
  OCCASIONS, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type Occasion, type ProductCategory, type SearchMissionInput, type ShoppingDepartment, type StyleId,
} from '~/types/thread'
import { optionalBoolean, optionalNumber, optionalRecord, optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'
import { downscaleDataUrl } from '~/utils/imageDownscale'
import { paletteFromDataUrl } from '~/utils/imagePalette'

// Matches the inspiration store's limit for one downscaled image.
const DIRECT_IMAGE_LIMIT = 200_000
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Turns an agent-supplied reference image into a stored guide: small JPEG plus colour palette when the browser can decode it. */
async function parseGuide(input: Record<string, unknown>) {
  const image = optionalRecord(input, 'referenceImage')
  const cues = optionalRecord(input, 'visualCues')
  const inspirationId = optionalString(input, 'inspirationId')
  let imageData: string | undefined
  if (image) {
    const contentType = requiredString(image, 'content_type').toLowerCase()
    if (!IMAGE_TYPES.has(contentType)) throw new Error('referenceImage.content_type must be image/jpeg, image/png, or image/webp.')
    const data = requiredString(image, 'data').replace(/\s+/g, '')
    if (!/^[A-Za-z0-9+/]+=*$/.test(data)) throw new Error('referenceImage.data must be base64 image bytes, not a URL.')
    imageData = `data:${contentType};base64,${data}`
    if (imageData.length > DIRECT_IMAGE_LIMIT || contentType !== 'image/jpeg') imageData = await downscaleDataUrl(imageData)
  }
  const palette = optionalStringArray(cues ?? {}, 'palette') ?? (imageData ? await paletteFromDataUrl(imageData) : undefined)
  return {
    imageData,
    inspirationId,
    palette,
    descriptors: optionalStringArray(cues ?? {}, 'descriptors'),
  }
}

type ThreadActions = ReturnType<typeof createThreadActions>

function parseMission(input: Record<string, unknown>): SearchMissionInput {
  const context = optionalRecord(input, 'context')
  const constraints = optionalRecord(input, 'constraints')
  const rawNeeds = input.needs
  let needs: SearchMissionInput['needs']
  if (rawNeeds !== undefined) {
    if (!Array.isArray(rawNeeds)) throw new Error('needs must be an array.')
    needs = rawNeeds.map((value, index) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`needs[${index}] must be an object.`)
      const need = value as Record<string, unknown>
      return {
        intent: requiredString(need, 'intent'),
        queries: optionalStringArray(need, 'queries') ?? [],
        categories: optionalStringArray(need, 'categories') as ProductCategory[] | undefined,
        required: optionalBoolean(need, 'required'),
        quantity: optionalNumber(need, 'quantity'),
        budgetCad: optionalNumber(need, 'budgetCad'),
        retailerIds: optionalStringArray(need, 'retailerIds'),
        storeDomains: optionalStringArray(need, 'storeDomains'),
        storeNames: optionalStringArray(need, 'storeNames'),
      }
    })
  }
  return {
    rawPrompt: requiredString(input, 'rawPrompt'),
    shoppingDepartment: optionalString(input, 'shoppingDepartment') as ShoppingDepartment | undefined,
    stylePreferences: optionalStringArray(input, 'stylePreferences') as StyleId[] | undefined,
    context: context ? {
      tripType: optionalString(context, 'tripType'),
      destination: optionalString(context, 'destination'),
      climateHints: optionalStringArray(context, 'climateHints'),
      occasions: optionalStringArray(context, 'occasions') as Occasion[] | undefined,
      notes: optionalString(context, 'notes'),
    } : undefined,
    needs,
    constraints: constraints ? {
      maxPriceCad: optionalNumber(constraints, 'maxPriceCad'),
      overallBudgetCad: optionalNumber(constraints, 'overallBudgetCad'),
      categories: optionalStringArray(constraints, 'categories') as ProductCategory[] | undefined,
      retailerIds: optionalStringArray(constraints, 'retailerIds'),
      storeDomains: optionalStringArray(constraints, 'storeDomains'),
      storeNames: optionalStringArray(constraints, 'storeNames'),
      excludedRetailerIds: optionalStringArray(constraints, 'excludedRetailerIds'),
    } : undefined,
  }
}

export function startShoppingSearchTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'start_shopping_search',
    title: 'Start a shopping mission',
    description: 'The one entry point for a new shopping request. Pass the person’s words as rawPrompt; Rove itself reads quantities ("three clothes and a perfume, two footwears"), the basket budget ("budget of $450 CAD"), the destination and climate, then allocates the budget and plans Shop and retailer research. Add structured needs only to refine that plan. If the person shared a photo, pass it as referenceImage (or describe it in visualCues): it becomes the style guide and drives a Shop visual search for every wearable need. Without a photo the mission runs entirely from the brief. Extract every store the person names, even without the words from/at. Supply unfamiliar names as constraints.storeNames or verified official domains as storeDomains. Named stores are hard restrictions: resolve their official domain through resolve_store before research. Use Rove search_shop_catalog for built-in anonymous Shop HTTP discovery (https://shop.com/skill.md and /shop.md); no local CLI, plugin or login is required. Use per-need store restrictions for mixed-retailer requests. Follow returned next steps, inspect Shop messages, and compare exact returned options before enrichment or adding to Your Thread. Only prepare merchant carts/checkouts on request; never complete payment.',
    inputSchema: {
      type: 'object',
      properties: {
        rawPrompt: { type: 'string', description: 'The user’s original shopping request.' },
        shoppingDepartment: { type: 'string', enum: SHOPPING_DEPARTMENTS.map(option => option.id) },
        stylePreferences: { type: 'array', items: { type: 'string', enum: STYLE_OPTIONS.map(option => option.id) }, maxItems: 10 },
        context: {
          type: 'object',
          properties: {
            tripType: { type: 'string' },
            destination: { type: 'string' },
            climateHints: { type: 'array', items: { type: 'string' }, maxItems: 8 },
            occasions: { type: 'array', items: { type: 'string', enum: OCCASIONS }, maxItems: 12 },
            notes: { type: 'string' },
          },
          additionalProperties: false,
        },
        needs: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              intent: { type: 'string' },
              queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
              categories: { type: 'array', items: { type: 'string', enum: PRODUCT_CATEGORIES }, maxItems: PRODUCT_CATEGORIES.length },
              required: { type: 'boolean' },
              quantity: { type: 'number', minimum: 1, maximum: 20, description: 'How many distinct products must fulfill this need. Defaults to 1.' },
              budgetCad: { type: 'number', minimum: 0.01, description: 'Maximum combined CAD subtotal for products selected for this need.' },
              retailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40, description: 'Hard store restriction for this need only. Use an empty array for an unrestricted need.' },
              storeDomains: { type: 'array', items: { type: 'string' }, maxItems: 10 },
              storeNames: { type: 'array', items: { type: 'string' }, maxItems: 10 },
            },
            required: ['intent', 'queries'],
            additionalProperties: false,
          },
        },
        referenceImage: {
          type: 'object',
          description: 'A photo the person shared as the style guide: base64 bytes, not a URL. Large images are resized in the browser.',
          properties: {
            content_type: { type: 'string', description: 'image/jpeg, image/png, or image/webp.' },
            data: { type: 'string', description: 'Base64-encoded image bytes.' },
          },
          required: ['content_type', 'data'],
          additionalProperties: false,
        },
        inspirationId: { type: 'string', description: 'Use an image already on the inspiration board as the style guide.' },
        visualCues: {
          type: 'object',
          description: 'What you see in the reference photo. Rove ranks with these and adds them to Shop’s relevance hint.',
          properties: {
            palette: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Garment colours, e.g. white, tan, denim.' },
            descriptors: { type: 'array', items: { type: 'string' }, maxItems: 8, description: 'Silhouette, fabric and style, e.g. relaxed linen, cropped, crochet.' },
          },
          additionalProperties: false,
        },
        constraints: {
          type: 'object',
          properties: {
            maxPriceCad: { type: 'number', minimum: 0.01 },
            overallBudgetCad: { type: 'number', minimum: 0.01, description: 'Maximum CAD subtotal for the proposed products across all required needs.' },
            categories: { type: 'array', items: { type: 'string', enum: PRODUCT_CATEGORIES }, maxItems: PRODUCT_CATEGORIES.length },
            storeDomains: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Verified official storefront domains for named stores outside the retailer registry. Rove applies a hard Shop shops filter and validates returned sellers.' },
            storeNames: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Unresolved store names; resolve_store must verify each official domain before research.' },
            retailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40 },
            excludedRetailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40 },
          },
          additionalProperties: false,
        },
      },
      required: ['rawPrompt'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    async execute(input) {
      const mission = parseMission(input)
      const guide = await parseGuide(input)
      return { ...actions.startGuidedSearch(mission, guide, 'agent'), shopIntegration: { binding: 'browser-http', endpoint: 'https://mcp.shop.com/', skillUrl: 'https://shop.com/skill.md', guidePath: '/shop.md', signInRequiredForDiscovery: false, instructions: 'Use Rove search_shop_catalog: it executes planned requests directly from the browser, without an installed CLI or Shop MCP connection. Read /shop.md and the official Shop skill before research. Only a real request failure establishes unavailability. Preserve exact options, IDs, currencies, messages and checkout URLs. If Shop fails or has no matching offers, use retailer fallback without broadening need-specific merchant constraints.' } }
    },
  }
}
