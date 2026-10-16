import { RETAILER_BY_ID, retailerForDomain } from '~/data/retailers'
import { pruneMerchantCarts, variantColor, variantSize } from '~/domain/cart/checkoutPlan'
import { canonicalizeProductUrl, cartItemId, productIdFromUrl, stableHash } from '~/domain/productIdentity'
import { evaluateMissionFulfillment } from '~/domain/research/fulfillment'
import {
  OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, RECOMMENDATION_REVIEW_STATUSES, RESEARCH_TARGET_STATUSES, SEARCH_STATUSES,
  SHOPPING_DEPARTMENTS, STYLE_OPTIONS, emptyInspirationState, emptySearchState,
  type CartState, type InspirationItem, type InspirationState, type MerchantCart, type Product, type ProductVariant, type ProductAvailability, type ProductCategory, type ProductCommerce, type RecommendationReview, type ReplacementContext,
  type ResearchTarget, type SearchMission, type ShopCatalogRequest, type SimilaritySeed, type SearchSession, type SearchState, type ShoppingDepartment, type StyleId,
} from '~/types/thread'

const categoryIds = new Set<string>(PRODUCT_CATEGORIES)
const departmentIds = new Set<string>(SHOPPING_DEPARTMENTS.map(item => item.id))
const styleIds = new Set<string>(STYLE_OPTIONS.map(item => item.id))
const occasionIds = new Set<string>(OCCASIONS)
const availabilityIds = new Set<string>(PRODUCT_AVAILABILITY)
const targetStatuses = new Set<string>(RESEARCH_TARGET_STATUSES)
const searchStatuses = new Set<string>(SEARCH_STATUSES)
const recommendationReviewStatuses = new Set<string>(RECOMMENDATION_REVIEW_STATUSES)

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function hydrateCommerce(value: unknown): ProductCommerce | undefined {
  const item = record(value)
  if (!item || item.provider !== 'shop' || typeof item.productId !== 'string' || typeof item.sellerDomain !== 'string' || typeof item.url !== 'string') {
    return undefined
  }
  const selectedOptions = hydrateOptions(item.selectedOptions)
  return {
    provider: 'shop',
    productId: item.productId,
    variantId: optionalString(item.variantId),
    sellerDomain: item.sellerDomain,
    sellerId: optionalString(item.sellerId),
    sellerName: optionalString(item.sellerName),
    sellerUrl: optionalString(item.sellerUrl),
    url: item.url,
    selectedOptions,
    checkoutUrl: optionalString(item.checkoutUrl),
  }
}

function hydrateOptions(value: unknown): Array<{ name: string; label: string }> {
  return Array.isArray(value)
    ? value.flatMap((option) => {
        const entry = record(option)
        return entry && typeof entry.name === 'string' && typeof entry.label === 'string' ? [{ name: entry.name, label: entry.label }] : []
      })
    : []
}

function hydrateVariants(value: unknown): ProductVariant[] | undefined {
  if (!Array.isArray(value)) return undefined
  const variants = value.flatMap((raw): ProductVariant[] => {
    const item = record(raw)
    if (!item || typeof item.id !== 'string' || typeof item.available !== 'boolean') return []
    const options = hydrateOptions(item.options)
    return [{
      id: item.id,
      options,
      size: variantSize(options),
      color: variantColor(options),
      available: item.available,
      priceMinor: typeof item.priceMinor === 'number' && Number.isInteger(item.priceMinor) ? item.priceMinor : undefined,
      currency: optionalString(item.currency),
      priceCad: positive(item.priceCad),
      checkoutUrl: optionalString(item.checkoutUrl),
      url: optionalString(item.url),
    }]
  })
  return variants.length ? variants : undefined
}

function hydrateMerchantCart(value: unknown): MerchantCart | null {
  const item = record(value)
  if (!item || typeof item.groupKey !== 'string' || typeof item.continueUrl !== 'string' || typeof item.itemsHash !== 'string') return null
  return {
    groupKey: item.groupKey,
    sellerName: typeof item.sellerName === 'string' ? item.sellerName : item.groupKey,
    itemsHash: item.itemsHash,
    continueUrl: item.continueUrl,
    cartId: optionalString(item.cartId),
    totalMinor: typeof item.totalMinor === 'number' && Number.isInteger(item.totalMinor) ? item.totalMinor : undefined,
    currency: optionalString(item.currency),
    messages: stringArray(item.messages),
    status: item.status === 'ordered' ? 'ordered' : 'ready',
    orderPermalink: optionalString(item.orderPermalink),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
  }
}

export function hydrateSimilaritySeed(value: unknown): SimilaritySeed | undefined {
  const item = record(value)
  if (item?.kind === 'product' && typeof item.productId === 'string' && typeof item.name === 'string') {
    return {
      kind: 'product',
      productId: item.productId,
      name: item.name,
      shopProductId: optionalString(item.shopProductId),
      category: typeof item.category === 'string' && categoryIds.has(item.category) ? item.category as ProductCategory : undefined,
    }
  }
  if (item?.kind === 'image' && typeof item.inspirationId === 'string' && (item.source === 'pinterest' || item.source === 'upload')) {
    return { kind: 'image', inspirationId: item.inspirationId, source: item.source, imageUrl: optionalString(item.imageUrl), note: optionalString(item.note) }
  }
  return undefined
}

function hydrateCatalogRequests(value: unknown): ShopCatalogRequest[] | undefined {
  if (!Array.isArray(value)) return undefined
  const requests = value.filter((request): request is ShopCatalogRequest => {
    const entry = record(request)
    return entry?.tool === 'search_catalog' && Boolean(record(record(entry.arguments)?.catalog))
  })
  return requests.length ? requests : undefined
}

export function migrateProductSnapshot(value: unknown): Product | null {
  const item = record(value)
  if (!item || typeof item.url !== 'string' || typeof item.name !== 'string') return null
  try {
    const url = canonicalizeProductUrl(item.url)
    const domainRetailer = retailerForDomain(new URL(url).hostname)
    const retailerId = typeof item.retailerId === 'string'
      ? item.retailerId
      : domainRetailer?.id ?? `retailer:${stableHash(new URL(url).hostname)}`
    const registryRetailer = RETAILER_BY_ID.get(retailerId) ?? domainRetailer
    const category = typeof item.category === 'string' && categoryIds.has(item.category)
      ? item.category as ProductCategory
      : undefined
    const departmentValue = typeof item.shoppingDepartment === 'string' ? item.shoppingDepartment : item.gender
    const shoppingDepartment = typeof departmentValue === 'string' && departmentIds.has(departmentValue)
      ? departmentValue as ShoppingDepartment
      : undefined
    const oldPrice = positive(item.price)
    const oldCurrency = typeof item.currency === 'string' ? item.currency.toUpperCase() : undefined
    const nativePrice = positive(item.nativePrice) ?? oldPrice
    const nativeCurrency = typeof item.nativeCurrency === 'string' ? item.nativeCurrency.toUpperCase() : oldCurrency
    const priceCad = positive(item.priceCad) ?? (nativeCurrency === 'CAD' ? nativePrice : undefined)
    const availability = typeof item.availability === 'string' && availabilityIds.has(item.availability)
      ? item.availability as ProductAvailability
      : 'unknown'
    const observedAt = typeof item.observedAt === 'string' && Number.isFinite(Date.parse(item.observedAt))
      ? new Date(item.observedAt).toISOString()
      : new Date(0).toISOString()
    const sizes = stringArray(item.sizes)
    const colors = stringArray(item.colors)
    return {
      id: productIdFromUrl(url),
      searchId: typeof item.searchId === 'string' ? item.searchId : 'legacy',
      targetId: typeof item.targetId === 'string' ? item.targetId : `target:${retailerId}`,
      needIds: stringArray(item.needIds),
      name: item.name.trim().slice(0, 220),
      brand: typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim().slice(0, 120) : undefined,
      retailer: registryRetailer?.name ?? (typeof item.retailer === 'string' ? item.retailer : new URL(url).hostname),
      retailerId,
      retailerLogo: registryRetailer?.logo ?? (typeof item.retailerLogo === 'string' ? item.retailerLogo : `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(new URL(url).origin)}&sz=128`),
      category,
      shoppingDepartment,
      nativePrice,
      nativeCurrency,
      priceCad,
      image: typeof item.image === 'string' && item.image ? item.image : undefined,
      imageWidth: positive(item.imageWidth),
      imageHeight: positive(item.imageHeight),
      url,
      colors,
      sizes,
      styleTags: stringArray(item.styleTags).filter((tag): tag is StyleId => styleIds.has(tag)),
      occasionTags: stringArray(item.occasionTags).filter((tag): tag is Product['occasionTags'][number] => occasionIds.has(tag)),
      description: typeof item.description === 'string' && item.description ? item.description.slice(0, 800) : undefined,
      material: typeof item.material === 'string' && item.material ? item.material.slice(0, 240) : undefined,
      source: item.source === 'agent' ? 'agent' : 'curated-fixture',
      stage: item.stage === 'enriched' ? 'enriched' : 'candidate',
      availability,
      observedAt,
      relevanceScore: typeof item.relevanceScore === 'number' && Number.isFinite(item.relevanceScore) ? item.relevanceScore : 0,
      commerce: hydrateCommerce(item.commerce),
      variants: hydrateVariants(item.variants),
    }
  } catch {
    return null
  }
}

function hydrateTarget(value: unknown): ResearchTarget | null {
  const item = record(value)
  if (!item || typeof item.id !== 'string' || typeof item.retailerId !== 'string' || typeof item.name !== 'string') return null
  if (typeof item.status !== 'string' || !targetStatuses.has(item.status)) return null
  return {
    id: item.id,
    retailerId: item.retailerId,
    name: item.name,
    logo: typeof item.logo === 'string' ? item.logo : '',
    sourceType: item.sourceType === 'discovery' || item.sourceType === 'catalog' ? item.sourceType : 'retailer',
    status: item.status as ResearchTarget['status'],
    relevanceScore: typeof item.relevanceScore === 'number' ? item.relevanceScore : 0,
    priorityScore: typeof item.priorityScore === 'number'
      ? item.priorityScore
      : typeof item.relevanceScore === 'number' ? item.relevanceScore : 0,
    priorityReasons: stringArray(item.priorityReasons),
    rank: typeof item.rank === 'number' ? item.rank : Number.MAX_SAFE_INTEGER,
    needIds: stringArray(item.needIds),
    queries: stringArray(item.queries),
    searchUrls: stringArray(item.searchUrls),
    productCount: typeof item.productCount === 'number' ? Math.max(0, item.productCount) : 0,
    rejectedCount: typeof item.rejectedCount === 'number' ? Math.max(0, item.rejectedCount) : 0,
    note: typeof item.note === 'string' ? item.note : '',
    claimId: typeof item.claimId === 'string' ? item.claimId : null,
    claimedBy: typeof item.claimedBy === 'string' ? item.claimedBy : null,
    claimedAt: typeof item.claimedAt === 'string' ? item.claimedAt : null,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
    catalogRequests: hydrateCatalogRequests(item.catalogRequests),
    seed: hydrateSimilaritySeed(item.seed),
  }
}

function hydrateMission(value: unknown): SearchMission | null {
  const item = record(value)
  if (!item || item.version !== 1 || typeof item.rawPrompt !== 'string' || typeof item.shoppingDepartment !== 'string') return null
  if (!departmentIds.has(item.shoppingDepartment) || !Array.isArray(item.needs) || !Array.isArray(item.derivedQueries)) return null
  const context = record(item.context)
  const constraints = record(item.constraints)
  if (!context || !constraints) return null
  const needs = item.needs.flatMap((value) => {
    const need = record(value)
    if (!need || typeof need.id !== 'string' || typeof need.intent !== 'string') return []
    return [{
      id: need.id,
      intent: need.intent,
      queries: stringArray(need.queries),
      categories: stringArray(need.categories).filter((category): category is ProductCategory => categoryIds.has(category)),
      required: need.required !== false,
      quantity: typeof need.quantity === 'number' && Number.isInteger(need.quantity) && need.quantity > 0 ? need.quantity : 1,
      budgetCad: positive(need.budgetCad),
      allocationCad: positive(need.allocationCad),
      priceCeilingCad: positive(need.priceCeilingCad),
      ...(Array.isArray(need.retailerIds) ? { retailerIds: stringArray(need.retailerIds) } : {}),
      ...(Array.isArray(need.storeDomains) ? { storeDomains: stringArray(need.storeDomains) } : {}),
      ...(Array.isArray(need.storeNames) ? { storeNames: stringArray(need.storeNames) } : {}),
    }]
  })
  if (!needs.length) return null
  return {
    version: 1,
    rawPrompt: item.rawPrompt,
    shoppingDepartment: item.shoppingDepartment as ShoppingDepartment,
    stylePreferences: stringArray(item.stylePreferences).filter((style): style is StyleId => styleIds.has(style)),
    context: {
      tripType: typeof context.tripType === 'string' ? context.tripType : undefined,
      destination: typeof context.destination === 'string' ? context.destination : undefined,
      climateHints: stringArray(context.climateHints),
      occasions: stringArray(context.occasions).filter((occasion): occasion is SearchMission['context']['occasions'][number] => occasionIds.has(occasion)),
      notes: typeof context.notes === 'string' ? context.notes : undefined,
    },
    needs,
    constraints: {
      maxPriceCad: positive(constraints.maxPriceCad),
      overallBudgetCad: positive(constraints.overallBudgetCad),
      categories: stringArray(constraints.categories).filter((category): category is ProductCategory => categoryIds.has(category)),
      retailerIds: stringArray(constraints.retailerIds),
      excludedRetailerIds: stringArray(constraints.excludedRetailerIds),
      storeDomains: stringArray(constraints.storeDomains),
      storeNames: stringArray(constraints.storeNames),
    },
    derivedQueries: stringArray(item.derivedQueries),
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date(0).toISOString(),
    seeds: Array.isArray(item.seeds)
      ? item.seeds.map(hydrateSimilaritySeed).filter((seed): seed is SimilaritySeed => Boolean(seed))
      : undefined,
  }
}

function hydrateRecommendationReview(value: unknown, products: readonly Product[]): RecommendationReview | undefined {
  const item = record(value)
  if (!item || typeof item.status !== 'string' || !recommendationReviewStatuses.has(item.status)) return undefined
  const knownProductIds = new Set(products.map(product => product.id))
  const productIds = stringArray(item.productIds).filter(productId => knownProductIds.has(productId))
  if (!productIds.length || typeof item.startedAt !== 'string' || typeof item.deadlineAt !== 'string') return undefined
  const resolution = ['user-accepted', 'timeout-accepted', 'replace-selected', 'replace-all'].includes(String(item.resolution))
    ? item.resolution as RecommendationReview['resolution']
    : null
  return {
    status: item.status as RecommendationReview['status'],
    productIds,
    likedProductIds: stringArray(item.likedProductIds).filter(productId => productIds.includes(productId)),
    rejectedProductIds: stringArray(item.rejectedProductIds).filter(productId => productIds.includes(productId)),
    startedAt: item.startedAt,
    deadlineAt: item.deadlineAt,
    completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
    resolution,
    replacementSearchId: typeof item.replacementSearchId === 'string' ? item.replacementSearchId : null,
  }
}

function hydrateReplacementContext(value: unknown): ReplacementContext | undefined {
  const item = record(value)
  if (!item || typeof item.rootSearchId !== 'string' || typeof item.rootPrompt !== 'string' || typeof item.sourceSearchId !== 'string') {
    return undefined
  }
  const preservedProducts = Array.isArray(item.preservedProducts)
    ? item.preservedProducts.map(migrateProductSnapshot).filter((product): product is Product => Boolean(product))
    : []
  return {
    rootSearchId: item.rootSearchId,
    rootPrompt: item.rootPrompt,
    sourceSearchId: item.sourceSearchId,
    preservedProducts,
    replacedProductIds: stringArray(item.replacedProductIds),
  }
}

function hydrateSearchSession(value: unknown): SearchSession | null {
  const item = record(value)
  if (!item || item.version !== 1 || typeof item.id !== 'string' || typeof item.status !== 'string' || !searchStatuses.has(item.status)) {
    return null
  }
  const mission = hydrateMission(item.mission)
  if (!mission || !Array.isArray(item.targets) || !Array.isArray(item.products)) return null
  const targets = item.targets.map(hydrateTarget).filter((target): target is ResearchTarget => Boolean(target)).map((target) => {
    if (target.needIds.length) return target
    const retailer = RETAILER_BY_ID.get(target.retailerId)
    const needIds = mission.needs
      .filter(need => !retailer || !need.categories.length || need.categories.some(category => retailer.capabilities.categories.includes(category)))
      .map(need => need.id)
    return { ...target, needIds }
  })
  const products = item.products.map(migrateProductSnapshot)
    .filter((product): product is Product => Boolean(product) && product?.searchId === item.id)
  const replacementContext = hydrateReplacementContext(item.replacementContext)
  const reviewProducts = [...(replacementContext?.preservedProducts ?? []), ...products]
  const session: SearchSession = {
    version: 1,
    id: item.id,
    status: item.status as SearchSession['status'],
    mission,
    targets,
    products,
    rankings: Array.isArray(item.rankings) ? item.rankings as SearchSession['rankings'] : [],
    fulfillment: evaluateMissionFulfillment(mission, products),
    acceptedCandidateCount: typeof item.acceptedCandidateCount === 'number' ? item.acceptedCandidateCount : products.length,
    rejectedCandidateCount: typeof item.rejectedCandidateCount === 'number' ? item.rejectedCandidateCount : 0,
    telemetry: Array.isArray(item.telemetry) ? (item.telemetry as SearchSession['telemetry']).slice(-250) : [],
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : mission.createdAt,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : mission.createdAt,
    completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
    cancellationReason: typeof item.cancellationReason === 'string' ? item.cancellationReason : null,
    revision: typeof item.revision === 'number' ? item.revision : 0,
    recommendationReview: hydrateRecommendationReview(item.recommendationReview, reviewProducts),
    replacementContext,
  }
  return session
}

export function hydrateSearchState(value: unknown): SearchState {
  const root = record(value)
  if (!root || (root.version !== 3 && root.version !== 4)) return emptySearchState()
  const activeSearch = hydrateSearchSession(root.activeSearch)
  const recentSearches = root.version === 4 && Array.isArray(root.recentSearches)
    ? root.recentSearches.map(hydrateSearchSession).filter((session): session is SearchSession => Boolean(session)).slice(0, 3)
    : []
  return { version: 4, activeSearch, recentSearches: recentSearches.filter(session => session.id !== activeSearch?.id) }
}

const MAX_INSPIRATION_ITEMS = 8

export function hydrateInspirationState(value: unknown): InspirationState {
  const root = record(value)
  if (!root || root.version !== 1 || !Array.isArray(root.items)) return emptyInspirationState()
  const items = root.items.flatMap((raw): InspirationItem[] => {
    const item = record(raw)
    if (!item || typeof item.id !== 'string' || (item.source !== 'pinterest' && item.source !== 'upload')) return []
    const imageUrl = optionalString(item.imageUrl)
    const imageData = optionalString(item.imageData)
    if (!imageUrl && !imageData) return []
    return [{
      id: item.id,
      source: item.source,
      imageUrl,
      imageData,
      sourceUrl: optionalString(item.sourceUrl),
      note: optionalString(item.note),
      needIds: stringArray(item.needIds),
      searchId: optionalString(item.searchId),
      targetId: optionalString(item.targetId),
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
    }]
  })
  return { version: 1, items: items.slice(0, MAX_INSPIRATION_ITEMS) }
}

export function hydrateCartState(value: unknown): CartState {
  const root = record(value)
  const rawItems = root && Array.isArray(root.items) ? root.items : []
  const items = rawItems.flatMap((rawItem) => {
    const item = record(rawItem)
    const product = migrateProductSnapshot(item?.product)
    if (!item || !product) return []
    const size = typeof item.size === 'string' && product.sizes.includes(item.size) ? item.size : undefined
    const color = typeof item.color === 'string' && product.colors.includes(item.color) ? item.color : undefined
    const variant = product.commerce ? product.variants?.find(variant => variant.id === item.variantId && variant.available
      && (!size || variant.size === size) && (!color || variant.color === color)) : undefined
    return [{
      id: cartItemId(product.id, size, color, variant?.id),
      productId: product.id,
      product,
      size,
      color,
      variantId: variant?.id,
      selectedOptions: variant?.options.map(option => ({ ...option })),
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
    }]
  })
  // Version 3 carts predate merchant handoffs; they migrate with none.
  const merchantCarts = root?.version === 4 && Array.isArray(root.merchantCarts)
    ? root.merchantCarts.map(hydrateMerchantCart).filter((merchantCart): merchantCart is MerchantCart => Boolean(merchantCart))
    : []
  const cart: CartState = { version: 4, items: [...new Map(items.map(item => [item.id, item])).values()], merchantCarts }
  return { ...cart, merchantCarts: pruneMerchantCarts(cart) }
}
