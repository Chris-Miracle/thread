import type { Ref } from 'vue'
import { RETAILERS, retailerForDomain, retailerSearchUrl } from '~/data/retailers'
import { canonicalizeProductUrl, cartItemId, productIdFromUrl, stableHash } from '~/domain/productIdentity'
import { rankProducts } from '~/domain/productSearch'
import type { ProductProvider } from '~/providers/ProductProvider'
import type { StorageAdapter } from '~/utils/storage'
import { AGENT_PRODUCTS_STORAGE_KEY, CART_STORAGE_KEY, PROFILE_STORAGE_KEY } from '~/utils/storage'
import { OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, SHOPPING_GENDERS, STYLE_OPTIONS, emptySearchLane } from '~/types/thread'
import type {
  ActionSource, AddToCartResult, AgentProductInput, AgentProductState, CartState, CartSummary, Occasion, Product,
  ProductAvailability, ProductCategory, ProductSearchInput, PublishProductsResult, SearchLane, SearchState,
  ResearchDepth, ResearchTarget, ResearchTargetStatus, ShoppingGender, StyleId, StyleProfile,
} from '~/types/thread'

export interface ThreadActionDependencies {
  profile: Ref<StyleProfile | null>
  cart: Ref<CartState>
  search: Ref<SearchState>
  agentProducts: Ref<AgentProductState>
  hydrated: Ref<boolean>
  provider: ProductProvider
  storage: StorageAdapter
  notify?: (message: string) => void
}

const styleIds = new Set<string>(STYLE_OPTIONS.map(style => style.id))
const genderIds = new Set<string>(SHOPPING_GENDERS.map(gender => gender.id))
const categoryIds = new Set<string>(PRODUCT_CATEGORIES)
const occasionIds = new Set<string>(OCCASIONS)
const availabilityIds = new Set<string>(PRODUCT_AVAILABILITY)
const blockedProductDomains = ['example.com', 'google.com', 'bing.com', 'pinterest.com', 'instagram.com']
let searchSequence = 0

const discoverySources = [
  { id: 'discovery:pinterest', name: 'Pinterest', domain: 'pinterest.com', url: 'https://www.pinterest.com/search/pins/?q={query}' },
  { id: 'discovery:google-shopping', name: 'Google Shopping', domain: 'google.com', url: 'https://www.google.com/search?tbm=shop&q={query}' },
] as const

const retailerAliases: Record<string, string[]> = {
  'fashion-nova': ['fashionnova'],
  'oh-polly': ['ohpolly'],
  abercrombie: ['abercombrie', 'a&f'],
  farfetch: ['fetch'],
  shopbop: ['shop bop', 'shop'],
  'good-american': ['goodamerican'],
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cleanString(value: unknown, label: string, max = 180): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  return value.trim().slice(0, max)
}

function stringList(value: unknown, label: string, maxItems = 24): string[] {
  if (!Array.isArray(value) || !value.length || !value.every(item => typeof item === 'string' && item.trim())) {
    throw new Error(`${label} must contain at least one value.`)
  }
  return [...new Set(value.map(item => String(item).trim().slice(0, 80)))].slice(0, maxItems)
}

function validHttpUrl(value: unknown, label: string): string {
  const raw = cleanString(value, label, 2000)
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use HTTPS or HTTP.`)
  return url.toString()
}

function validateProfile(input: { name: string; gender: string; styles: readonly string[] }, requireStyle: boolean): StyleProfile {
  const name = input.name.trim()
  if (!name) throw new Error('Enter your first name to continue.')
  if (!genderIds.has(input.gender)) throw new Error('Choose who you are shopping for.')
  if (requireStyle && !input.styles.length) throw new Error('Choose at least one style.')
  if (input.styles.length > 3) throw new Error('Choose up to three styles.')
  const uniqueStyles = [...new Set(input.styles)]
  if (uniqueStyles.length !== input.styles.length) throw new Error('Choose each style only once.')
  if (!uniqueStyles.every(style => styleIds.has(style))) throw new Error('One or more selected styles are not supported.')
  return { version: 2, name, gender: input.gender as ShoppingGender, styles: uniqueStyles as StyleId[] }
}

export function validateStyleProfile(input: { name: string; gender: string; styles: readonly string[] }): StyleProfile {
  return validateProfile(input, true)
}

export function validateAgentStyleProfile(input: { name: string; gender: string; styles?: readonly string[] }): StyleProfile {
  return validateProfile({ ...input, styles: input.styles ?? [] }, false)
}

function hydrateProfile(value: unknown): StyleProfile | null {
  if (!isRecord(value) || value.version !== 2 || typeof value.name !== 'string' || typeof value.gender !== 'string' || !Array.isArray(value.styles)) return null
  try {
    return validateAgentStyleProfile({
      name: value.name,
      gender: value.gender,
      styles: value.styles.filter((style): style is string => typeof style === 'string'),
    })
  } catch { return null }
}

function cloneProduct(product: Product): Product {
  return {
    ...product,
    colors: [...product.colors],
    sizes: [...product.sizes],
    styleTags: [...product.styleTags],
    occasionTags: [...product.occasionTags],
  }
}

function productFromSnapshot(value: unknown): Product | null {
  if (!isRecord(value)) return null
  try {
    const url = canonicalizeProductUrl(cleanString(value.url, 'Product URL', 2000))
    const image = validHttpUrl(value.image, 'Product image')
    const price = Number(value.price)
    if (!Number.isFinite(price) || price <= 0) return null
    const category = typeof value.category === 'string' && categoryIds.has(value.category) ? value.category as ProductCategory : null
    const gender = typeof value.gender === 'string' && genderIds.has(value.gender) ? value.gender as ShoppingGender : null
    const availability = typeof value.availability === 'string' && availabilityIds.has(value.availability) ? value.availability as ProductAvailability : 'unknown'
    if (!category || !gender) return null
    return {
      id: productIdFromUrl(url),
      name: cleanString(value.name, 'Product name'),
      brand: cleanString(value.brand, 'Product brand'),
      retailer: cleanString(value.retailer, 'Retailer'),
      retailerId: cleanString(value.retailerId, 'Retailer ID'),
      retailerLogo: validHttpUrl(value.retailerLogo, 'Retailer logo'),
      category,
      gender,
      price,
      currency: cleanString(value.currency, 'Currency', 3).toUpperCase(),
      image,
      url,
      colors: stringList(value.colors, 'Colours'),
      sizes: stringList(value.sizes, 'Sizes'),
      styleTags: Array.isArray(value.styleTags) ? value.styleTags.filter((tag): tag is StyleId => typeof tag === 'string' && styleIds.has(tag)) : [],
      occasionTags: Array.isArray(value.occasionTags) ? value.occasionTags.filter((tag): tag is Occasion => typeof tag === 'string' && occasionIds.has(tag)) : [],
      description: cleanString(value.description, 'Description', 500),
      source: value.source === 'agent' ? 'agent' : 'curated',
      availability,
      observedAt: cleanString(value.observedAt, 'Observed date', 60),
    }
  } catch { return null }
}

function normalizeAgentProduct(input: AgentProductInput): Product {
  const url = canonicalizeProductUrl(validHttpUrl(input.url, 'Product URL'))
  const parsedUrl = new URL(url)
  if (blockedProductDomains.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`))) {
    throw new Error('Use a canonical retailer product page, not a search, social, or placeholder URL.')
  }
  const image = validHttpUrl(input.image, 'Product image')
  const price = Number(input.price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be greater than zero.')
  const currency = cleanString(input.currency, 'Currency', 3).toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter ISO code.')
  if (!categoryIds.has(input.category)) throw new Error(`Unsupported category: ${input.category}`)
  const gender = input.gender ?? 'all'
  if (!genderIds.has(gender)) throw new Error(`Unsupported shopping department: ${gender}`)
  const observedAt = cleanString(input.observedAt, 'Observed date', 60)
  const observedTime = Date.parse(observedAt)
  if (!Number.isFinite(observedTime)) throw new Error('Observed date must be an ISO date or date-time.')
  if (observedTime > Date.now() + 86_400_000) throw new Error('Observed date cannot be in the future.')
  const knownRetailer = retailerForDomain(parsedUrl.hostname)
  const retailerName = cleanString(input.retailer, 'Retailer')
  const retailerId = knownRetailer?.id ?? `retailer:${stableHash(parsedUrl.hostname)}`
  const retailerLogo = knownRetailer?.logo ?? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsedUrl.origin)}&sz=128`
  const availability = input.availability ?? 'unknown'
  if (!availabilityIds.has(availability)) throw new Error(`Unsupported availability: ${availability}`)

  return {
    id: productIdFromUrl(url),
    name: cleanString(input.name, 'Product name'),
    brand: cleanString(input.brand, 'Product brand'),
    retailer: retailerName,
    retailerId,
    retailerLogo,
    category: input.category,
    gender,
    price,
    currency,
    image,
    url,
    colors: stringList(input.colors, 'Colours'),
    sizes: stringList(input.sizes, 'Sizes'),
    styleTags: [...new Set(input.styleTags ?? [])].filter(tag => styleIds.has(tag)).slice(0, 8),
    occasionTags: [...new Set(input.occasionTags ?? [])].filter(tag => occasionIds.has(tag)).slice(0, 8),
    description: cleanString(input.description, 'Description', 500),
    source: 'agent',
    availability,
    observedAt: new Date(observedTime).toISOString(),
  }
}

function laneWith(lane: SearchLane, patch: Partial<SearchLane>): SearchLane {
  return { ...lane, ...patch }
}

function normalizedWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim()
}

function queryMentionsRetailer(query: string, retailer: typeof RETAILERS[number]): boolean {
  const normalized = normalizedWords(query)
  const candidates = [retailer.name, retailer.id, ...(retailerAliases[retailer.id] ?? [])]
  return candidates.some(candidate => normalized.includes(normalizedWords(candidate)))
}

function makeResearchTargets(input: ProductSearchInput, profile: StyleProfile | null, depth: ResearchDepth): ResearchTarget[] {
  const eligible = RETAILERS.filter(retailer => !profile || profile.gender === 'all' || retailer.departments.includes(profile.gender) || retailer.departments.includes('all'))
  const requested = input.retailerIds?.length ? eligible.filter(retailer => input.retailerIds?.includes(retailer.id)) : []
  const mentioned = eligible.filter(retailer => queryMentionsRetailer(input.query, retailer))
  const ordered = requested.length ? requested : mentioned.length ? mentioned : eligible
  const limit = requested.length || mentioned.length ? ordered.length : depth === 'focused' ? 6 : depth === 'balanced' ? 14 : ordered.length
  const nowTargets: ResearchTarget[] = ordered.slice(0, limit).map(retailer => ({
    id: `target:${retailer.id}`,
    retailerId: retailer.id,
    name: retailer.name,
    logo: retailer.logo,
    url: retailerSearchUrl(retailer, input.query),
    sourceType: 'retailer',
    status: 'queued',
    productCount: 0,
    note: '',
    updatedAt: null,
  }))
  if (!requested.length && !mentioned.length && depth === 'deep') {
    nowTargets.push(...discoverySources.map(source => ({
      id: source.id,
      retailerId: source.id,
      name: source.name,
      logo: `https://www.google.com/s2/favicons?domain_url=https://${source.domain}&sz=128`,
      url: source.url.replace('{query}', encodeURIComponent(input.query)),
      sourceType: 'discovery' as const,
      status: 'queued' as const,
      productCount: 0,
      note: 'Discovery only. Publish the final canonical retailer product page, never this source URL.',
      updatedAt: null,
    })))
  }
  return nowTargets
}

export function createThreadActions(deps: ThreadActionDependencies) {
  function cloneCartItem(item: CartState['items'][number]): CartState['items'][number] {
    return { ...item, product: cloneProduct(item.product) }
  }

  function persistProfile() {
    if (deps.profile.value) deps.storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(deps.profile.value))
    else deps.storage.removeItem(PROFILE_STORAGE_KEY)
  }

  function persistCart() {
    deps.storage.setItem(CART_STORAGE_KEY, JSON.stringify(deps.cart.value))
  }

  function persistAgentProducts() {
    deps.storage.setItem(AGENT_PRODUCTS_STORAGE_KEY, JSON.stringify(deps.agentProducts.value))
  }

  function allProducts(): Product[] {
    const products = [...deps.provider.all(), ...deps.agentProducts.value.products]
    return [...new Map(products.map(product => [product.id, product])).values()]
  }

  function getProductById(productId: string): Product | undefined {
    return deps.agentProducts.value.products.find(product => product.id === productId) ?? deps.provider.getById(productId)
  }

  function hydrate() {
    if (deps.hydrated.value) return
    deps.profile.value = hydrateProfile(safeParse(deps.storage.getItem(PROFILE_STORAGE_KEY)))

    const storedAgentProducts = safeParse(deps.storage.getItem(AGENT_PRODUCTS_STORAGE_KEY))
    const agentValues = isRecord(storedAgentProducts) && storedAgentProducts.version === 1 && Array.isArray(storedAgentProducts.products)
      ? storedAgentProducts.products : []
    const products = agentValues.map(productFromSnapshot).filter((product): product is Product => Boolean(product) && product?.source === 'agent')
    deps.agentProducts.value = { version: 1, products: [...new Map(products.map(product => [product.id, product])).values()] }

    const storedCart = safeParse(deps.storage.getItem(CART_STORAGE_KEY))
    const rawItems = isRecord(storedCart) && Array.isArray(storedCart.items) ? storedCart.items : []
    const items = rawItems.flatMap((item): CartState['items'] => {
      if (!isRecord(item) || typeof item.productId !== 'string') return []
      const currentProduct = getProductById(item.productId)
      const product = currentProduct ?? productFromSnapshot(item.product)
      if (!product) return []
      const size = typeof item.size === 'string' && product.sizes.includes(item.size) ? item.size : undefined
      const color = typeof item.color === 'string' && product.colors.includes(item.color) ? item.color : undefined
      return [{
        id: cartItemId(product.id, size, color),
        productId: product.id,
        product,
        size,
        color,
        addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
      }]
    })
    deps.cart.value = { version: 2, items: [...new Map(items.map(item => [item.id, item])).values()] }
    deps.hydrated.value = true
    persistAgentProducts()
    persistCart()
  }

  function getStyleProfile(): StyleProfile | null {
    return deps.profile.value ? { ...deps.profile.value, styles: [...deps.profile.value.styles] } : null
  }

  function saveStyleProfile(input: { name: string; gender: string; styles: readonly string[] }, source: ActionSource = 'human'): StyleProfile {
    const profile = validateStyleProfile(input)
    deps.profile.value = profile
    persistProfile()
    if (source !== 'debug') deps.notify?.(`Welcome to Thread, ${profile.name}.`)
    return getStyleProfile()!
  }

  function setupProfile(input: {
    name: string
    gender: string
    styles?: readonly string[]
    replaceExisting?: boolean
  }) {
    const existing = getStyleProfile()
    if (existing && !input.replaceExisting) {
      return { status: 'existing' as const, profile: existing }
    }

    const profile = validateAgentStyleProfile({
      name: input.name,
      gender: input.gender,
      styles: input.styles ?? existing?.styles ?? [],
    })
    deps.profile.value = profile
    persistProfile()
    deps.notify?.(existing ? 'Agent updated your Thread profile.' : `Agent set up Thread for ${profile.name}.`)
    return { status: existing ? 'updated' as const : 'created' as const, profile: getStyleProfile()! }
  }

  function clearStyleProfile() {
    deps.profile.value = null
    persistProfile()
  }

  function resetWorkspace() {
    deps.storage.removeItem(PROFILE_STORAGE_KEY)
    deps.storage.removeItem(CART_STORAGE_KEY)
    deps.storage.removeItem(AGENT_PRODUCTS_STORAGE_KEY)
    deps.profile.value = null
    deps.cart.value = { version: 2, items: [] }
    deps.agentProducts.value = { version: 1, products: [] }
    deps.search.value = { results: emptySearchLane() }
    deps.hydrated.value = true
  }

  function validateSearchInput(input: ProductSearchInput): ProductSearchInput {
    const query = input.query.trim()
    if (!query) throw new Error('A shopping query is required.')
    if (input.category && !categoryIds.has(input.category)) throw new Error(`Unsupported category: ${input.category}`)
    if (input.occasion && !occasionIds.has(input.occasion)) throw new Error(`Unsupported occasion: ${input.occasion}`)
    if (input.maxPrice !== undefined && (!Number.isFinite(input.maxPrice) || input.maxPrice <= 0)) throw new Error('Maximum price must be greater than zero.')
    const retailerIds = input.retailerIds?.filter(id => RETAILERS.some(retailer => retailer.id === id))
    return { ...input, query, retailerIds: retailerIds?.length ? [...new Set(retailerIds)] : undefined }
  }

  async function searchProducts(input: ProductSearchInput, source: ActionSource = 'human'): Promise<Product[]> {
    const validInput = validateSearchInput(input)
    const now = new Date().toISOString()
    deps.search.value = {
      results: laneWith(deps.search.value.results, {
        searchId: null, query: validInput.query, input: validInput, results: [], status: 'loading', hasSearched: true, error: null, startedAt: now, updatedAt: now, exploredRetailers: [], researchDepth: 'focused', researchTargets: [],
      }),
    }
    try {
      const profile = deps.profile.value
      const results = rankProducts(allProducts(), validInput, profile?.styles ?? [], profile?.gender ?? 'all')
      deps.search.value = {
        results: laneWith(deps.search.value.results, { results, status: 'success', error: null, updatedAt: new Date().toISOString(), exploredRetailers: [...new Set(results.map(product => product.retailer))] }),
      }
      if (source === 'agent') deps.notify?.(`Agent searched Thread for “${validInput.query}”.`)
      return results.map(cloneProduct)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search could not be completed.'
      deps.search.value = { results: laneWith(deps.search.value.results, { status: 'error', error: message }) }
      throw error
    }
  }

  function beginAgentSearch(input: ProductSearchInput, depth: ResearchDepth = 'deep') {
    const validInput = validateSearchInput(input)
    searchSequence += 1
    const searchId = `search:${Date.now().toString(36)}:${searchSequence.toString(36)}:${stableHash(validInput.query)}`
    const now = new Date().toISOString()
    deps.search.value = {
      results: {
        searchId,
        query: validInput.query,
        input: validInput,
        results: [],
        status: 'exploring',
        hasSearched: true,
        error: null,
        startedAt: now,
        updatedAt: now,
        exploredRetailers: [],
        researchDepth: depth,
        researchTargets: makeResearchTargets(validInput, getStyleProfile(), depth),
      },
    }
    deps.notify?.(`Agent is exploring retailers for “${validInput.query}”.`)
    const profile = getStyleProfile()
    return { searchId, query: validInput.query, profile, targets: deps.search.value.results.researchTargets.map(target => ({ ...target })) }
  }

  function publishAgentProducts(input: {
    searchId: string
    query: string
    products: AgentProductInput[]
    complete?: boolean
    targetId?: string
    targetComplete?: boolean
    exploredRetailers?: string[]
  }): PublishProductsResult {
    if (!input.searchId.trim()) throw new Error('A search ID is required.')
    if (deps.search.value.results.searchId && deps.search.value.results.searchId !== input.searchId) {
      throw new Error('This search ID is stale. Start a new retailer search before publishing.')
    }
    if (!Array.isArray(input.products) || !input.products.length) throw new Error('Publish at least one verified product.')
    if (input.products.length > 40) throw new Error('Publish at most 40 products per update.')

    const accepted: Product[] = []
    const rejected: Array<{ index: number; reason: string }> = []
    input.products.forEach((product, index) => {
      try { accepted.push(normalizeAgentProduct(product)) }
      catch (error) { rejected.push({ index, reason: error instanceof Error ? error.message : 'Invalid product.' }) }
    })
    if (!accepted.length) throw new Error(`No products were accepted. ${rejected[0]?.reason ?? ''}`.trim())

    const productRegistry = new Map(deps.agentProducts.value.products.map(product => [product.id, product]))
    accepted.forEach(product => productRegistry.set(product.id, product))
    deps.agentProducts.value = { version: 1, products: [...productRegistry.values()].slice(-120) }
    persistAgentProducts()

    const visible = new Map(deps.search.value.results.results.map(product => [product.id, product]))
    accepted.forEach(product => visible.set(product.id, product))
    const exploredRetailers = [...new Set([
      ...deps.search.value.results.exploredRetailers,
      ...(input.exploredRetailers ?? []),
      ...accepted.map(product => product.retailer),
    ])]
    const now = new Date().toISOString()
    const publishedRetailers = new Set(accepted.map(product => product.retailerId))
    const researchTargets = deps.search.value.results.researchTargets.map(target => {
      const matchesTarget = target.id === input.targetId || publishedRetailers.has(target.retailerId)
      if (!matchesTarget) return target
      return {
        ...target,
        status: input.targetComplete || input.complete ? 'complete' as const : 'exploring' as const,
        productCount: target.productCount + accepted.filter(product => product.retailerId === target.retailerId).length,
        updatedAt: now,
      }
    })
    const hasPendingTargets = researchTargets.some(target => target.status === 'queued' || target.status === 'exploring')
    deps.search.value = {
      results: laneWith(deps.search.value.results, {
        searchId: input.searchId,
        query: input.query.trim() || deps.search.value.results.query,
        results: [...visible.values()],
        status: input.complete === true && !hasPendingTargets ? 'success' : 'exploring',
        hasSearched: true,
        error: null,
        updatedAt: now,
        startedAt: deps.search.value.results.startedAt ?? now,
        exploredRetailers,
        researchTargets,
      }),
    }
    deps.notify?.(`Agent added ${accepted.length} verified ${accepted.length === 1 ? 'find' : 'finds'} from ${new Set(accepted.map(product => product.retailer)).size} ${new Set(accepted.map(product => product.retailer)).size === 1 ? 'store' : 'stores'}.`)
    return {
      searchId: input.searchId,
      accepted: accepted.map(cloneProduct),
      rejected,
      visibleCount: deps.search.value.results.results.length,
    }
  }

  function reportResearchTarget(input: { searchId: string; targetId: string; status: ResearchTargetStatus; note?: string }) {
    if (deps.search.value.results.searchId !== input.searchId) throw new Error('This search ID is stale.')
    const target = deps.search.value.results.researchTargets.find(candidate => candidate.id === input.targetId)
    if (!target) throw new Error(`Research target not found: ${input.targetId}`)
    const now = new Date().toISOString()
    const researchTargets = deps.search.value.results.researchTargets.map(candidate => candidate.id === input.targetId
      ? { ...candidate, status: input.status, note: input.note?.trim().slice(0, 240) ?? candidate.note, updatedAt: now }
      : candidate)
    deps.search.value = { results: laneWith(deps.search.value.results, { researchTargets, updatedAt: now }) }
    return { ...researchTargets.find(candidate => candidate.id === input.targetId)! }
  }

  function finishAgentSearch(searchId: string) {
    if (deps.search.value.results.searchId !== searchId) throw new Error('This search ID is stale.')
    const now = new Date().toISOString()
    const targets = deps.search.value.results.researchTargets
    const pending = targets.filter(target => target.status === 'queued' || target.status === 'exploring')
    if (pending.length) {
      return { finished: false, searchId, visibleCount: deps.search.value.results.results.length, completedTargets: targets.length - pending.length, pendingTargets: pending.map(target => ({ id: target.id, name: target.name, status: target.status })) }
    }
    deps.search.value = { results: laneWith(deps.search.value.results, { status: 'success', updatedAt: now }) }
    return { finished: true, searchId, visibleCount: deps.search.value.results.results.length, completedTargets: targets.length, pendingTargets: [] }
  }

  function getResearchProgress() {
    const lane = deps.search.value.results
    return { searchId: lane.searchId, query: lane.query, depth: lane.researchDepth, status: lane.status, visibleCount: lane.results.length, targets: lane.researchTargets.map(target => ({ ...target })) }
  }

  function failAgentSearch(searchId: string, message: string) {
    if (deps.search.value.results.searchId !== searchId) return false
    deps.search.value = {
      results: laneWith(deps.search.value.results, { status: 'error', error: message.trim() || 'The agent search stopped.', updatedAt: new Date().toISOString() }),
    }
    return true
  }

  function addToCart(productId: string, options: { size?: string; color?: string } = {}, source: ActionSource = 'human'): AddToCartResult {
    const product = getProductById(productId)
    if (!product) throw new Error(`Product not found: ${productId}`)
    if (product.availability === 'out-of-stock') throw new Error(`${product.name} is marked out of stock.`)
    if (options.size && !product.sizes.includes(options.size)) throw new Error(`${options.size} is not an available size for ${product.name}.`)
    if (options.color && !product.colors.includes(options.color)) throw new Error(`${options.color} is not an available colour for ${product.name}.`)
    const id = cartItemId(product.id, options.size, options.color)
    const existing = deps.cart.value.items.find(item => item.id === id)
    if (existing) {
      const summary = getCart()
      return { success: true, duplicate: true, item: cloneCartItem(existing), cartCount: summary.itemCount, totals: summary.totals }
    }
    const item = { id, productId: product.id, product: cloneProduct(product), size: options.size, color: options.color, addedAt: new Date().toISOString() }
    deps.cart.value = { version: 2, items: [...deps.cart.value.items, item] }
    persistCart()
    if (source === 'agent') deps.notify?.(`Agent added ${product.name} to your Thread.`)
    else if (source === 'human') deps.notify?.(`${product.name} added to your Thread.`)
    const summary = getCart()
    return { success: true, duplicate: false, item: cloneCartItem(item), cartCount: summary.itemCount, totals: summary.totals }
  }

  function removeFromCart(itemId: string, source: ActionSource = 'human'): boolean {
    const item = deps.cart.value.items.find(candidate => candidate.id === itemId)
    if (!item) return false
    deps.cart.value = { version: 2, items: deps.cart.value.items.filter(candidate => candidate.id !== itemId) }
    persistCart()
    if (source === 'agent') deps.notify?.(`Agent removed ${item.product.name} from your Thread.`)
    return true
  }

  function clearCart() {
    deps.cart.value = { version: 2, items: [] }
    persistCart()
  }

  function getCart(): CartSummary {
    const items = deps.cart.value.items.map(cloneCartItem)
    const totals = new Map<string, number>()
    items.forEach(item => totals.set(item.product.currency, (totals.get(item.product.currency) ?? 0) + item.product.price))
    return {
      items,
      itemCount: items.length,
      totals: [...totals.entries()].map(([currency, subtotal]) => ({ currency, subtotal: Number(subtotal.toFixed(2)) })),
    }
  }

  function getVisibleProducts(): Product[] {
    return deps.search.value.results.results.map(cloneProduct)
  }

  function getRetailers() {
    return RETAILERS.map(retailer => ({ ...retailer, departments: [...retailer.departments], tags: [...retailer.tags] }))
  }

  return {
    hydrate,
    getStyleProfile,
    saveStyleProfile,
    setupProfile,
    clearStyleProfile,
    resetWorkspace,
    getProductById,
    getVisibleProducts,
    getRetailers,
    searchProducts,
    beginAgentSearch,
    publishAgentProducts,
    reportResearchTarget,
    finishAgentSearch,
    getResearchProgress,
    failAgentSearch,
    addToCart,
    removeFromCart,
    clearCart,
    getCart,
  }
}
