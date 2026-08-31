import { RETAILER_BY_ID, isProductUrlForRetailer, retailerForDomain } from '~/data/retailers'
import { canonicalizeProductUrl, productIdFromUrl, stableHash } from '~/domain/productIdentity'
import { isDepartmentEligible } from '~/domain/research/scheduler'
import { resolveCandidateNeedIds } from '~/domain/research/fulfillment'
import {
  OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type Product, type ProductCandidateInput, type ProductEnrichmentInput, type ResearchTarget,
  type SearchSession,
} from '~/types/thread'

const categoryIds = new Set<string>(PRODUCT_CATEGORIES)
const departmentIds = new Set<string>(SHOPPING_DEPARTMENTS.map(item => item.id))
const styleIds = new Set<string>(STYLE_OPTIONS.map(item => item.id))
const occasionIds = new Set<string>(OCCASIONS)
const availabilityIds = new Set<string>(PRODUCT_AVAILABILITY)
const blockedDomains = new Set(['example.com', 'google.com', 'bing.com', 'pinterest.com', 'instagram.com'])

function requiredText(value: unknown, label: string, max = 220): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function optionalText(value: unknown, max = 500): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : undefined
}

function optionalHttpUrl(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  const raw = requiredText(value, label, 2_000)
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use HTTP or HTTPS.`)
  return url.toString()
}

function positiveNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`)
  return Number(value.toFixed(2))
}

function cleanStringList(value: unknown, label: string, maxItems = 24): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`)
  }
  return [...new Set(value.map(item => String(item).trim().slice(0, 80)))].slice(0, maxItems)
}

function normalizePrices(input: {
  nativePrice?: number
  nativeCurrency?: string
  priceCad?: number
}, maxPriceCad?: number): Pick<Product, 'nativePrice' | 'nativeCurrency' | 'priceCad'> {
  let nativePrice = positiveNumber(input.nativePrice, 'nativePrice')
  let nativeCurrency = optionalText(input.nativeCurrency, 3)?.toUpperCase()
  let priceCad = positiveNumber(input.priceCad, 'priceCad')
  if (nativeCurrency && !/^[A-Z]{3}$/.test(nativeCurrency)) throw new Error('nativeCurrency must be a three-letter ISO code.')
  if (nativeCurrency && nativePrice === undefined) throw new Error('nativePrice is required when nativeCurrency is provided.')
  if (nativePrice !== undefined && !nativeCurrency) throw new Error('nativeCurrency is required when nativePrice is provided.')
  if (priceCad !== undefined && nativePrice === undefined && nativeCurrency === undefined) {
    nativePrice = priceCad
    nativeCurrency = 'CAD'
  }
  if (nativeCurrency === 'CAD' && nativePrice !== undefined) {
    if (priceCad !== undefined && Math.abs(priceCad - nativePrice) > 0.01) {
      throw new Error('priceCad must equal nativePrice for a CAD listing.')
    }
    priceCad = nativePrice
  }
  if (nativeCurrency && nativeCurrency !== 'CAD' && nativePrice !== undefined && priceCad === undefined) {
    throw new Error('Non-CAD listings require an explicitly verified priceCad; THREAD does not guess exchange rates.')
  }
  if (maxPriceCad !== undefined) {
    if (priceCad === undefined) throw new Error('A verified priceCad is required to enforce this search budget.')
    if (priceCad > maxPriceCad) throw new Error(`Product exceeds the mission budget of CAD ${maxPriceCad.toFixed(2)}.`)
  }
  return { nativePrice, nativeCurrency, priceCad }
}

function isUnknownProductUrl(url: URL): boolean {
  if (url.pathname === '/' || url.pathname.length < 5) return false
  if (/(?:^|\/)(search|collections?|category|categories|shop-all)(?:\/|$)/i.test(url.pathname)) return false
  return !url.searchParams.has('q') && !url.searchParams.has('query') && !url.searchParams.has('searchTerm')
}

function validateHardConstraints(product: Pick<Product, 'retailerId' | 'category' | 'shoppingDepartment' | 'priceCad'>, session: SearchSession): void {
  const constraints = session.mission.constraints
  if (constraints.retailerIds.length && !constraints.retailerIds.includes(product.retailerId)) {
    throw new Error('Product retailer is outside the mission retailer restriction.')
  }
  if (constraints.excludedRetailerIds.includes(product.retailerId)) {
    throw new Error('Product retailer is excluded from this mission.')
  }
  if (constraints.categories.length) {
    if (!product.category) throw new Error('category is required to enforce this mission.')
    if (!constraints.categories.includes(product.category)) throw new Error('Product category is outside the mission category constraint.')
  }
  if (!isDepartmentEligible(product.shoppingDepartment, session.mission.shoppingDepartment)) {
    throw new Error('Product shopping department does not match the mission.')
  }
  if (session.mission.shoppingDepartment !== 'all' && !product.shoppingDepartment) {
    throw new Error('shoppingDepartment is required to enforce this mission.')
  }
  if (constraints.maxPriceCad !== undefined) {
    if (product.priceCad === undefined) throw new Error('priceCad is required to enforce this mission budget.')
    if (product.priceCad > constraints.maxPriceCad) throw new Error('Product exceeds the mission budget.')
  }
}

export function normalizeCandidate(
  input: ProductCandidateInput,
  session: SearchSession,
  target: ResearchTarget,
  now = new Date().toISOString(),
): Product {
  const canonicalUrl = canonicalizeProductUrl(requiredText(input.url, 'url', 2_000))
  const parsedUrl = new URL(canonicalUrl)
  const normalizedHostname = parsedUrl.hostname.replace(/^www\./, '')
  if ([...blockedDomains].some(domain => normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`))) {
    throw new Error('Publish the canonical retailer product page, not a search, social, discovery, or placeholder URL.')
  }
  const knownRetailer = retailerForDomain(parsedUrl.hostname)
  if (target.sourceType === 'retailer') {
    const targetRetailer = RETAILER_BY_ID.get(target.retailerId)
    if (!targetRetailer) throw new Error('Research target retailer is not registered.')
    if (!knownRetailer || knownRetailer.id !== target.retailerId) {
      throw new Error(`Product domain does not match target retailer ${target.name}.`)
    }
  }
  if (knownRetailer && !isProductUrlForRetailer(knownRetailer, canonicalUrl)) {
    throw new Error('URL is not a canonical retailer product page.')
  }
  if (!knownRetailer && (target.sourceType !== 'discovery' || !isUnknownProductUrl(parsedUrl))) {
    throw new Error('Unknown retailer products are accepted only from discovery targets with a canonical product-like URL.')
  }

  const category = input.category
  if (category !== undefined && !categoryIds.has(category)) throw new Error('Unsupported category.')
  const shoppingDepartment = input.shoppingDepartment
  if (shoppingDepartment !== undefined && !departmentIds.has(shoppingDepartment)) throw new Error('Unsupported shoppingDepartment.')
  const image = optionalHttpUrl(input.image, 'image')
  const imageWidth = positiveNumber(input.imageWidth, 'imageWidth')
  const imageHeight = positiveNumber(input.imageHeight, 'imageHeight')
  if ((imageWidth === undefined) !== (imageHeight === undefined)) throw new Error('imageWidth and imageHeight must be provided together.')
  const prices = normalizePrices(input, session.mission.constraints.maxPriceCad)
  const retailerId = knownRetailer?.id ?? `retailer:${stableHash(normalizedHostname)}`
  const retailer = knownRetailer?.name ?? optionalText(input.retailer, 100) ?? normalizedHostname
  const product: Product = {
    id: productIdFromUrl(canonicalUrl),
    searchId: session.id,
    targetId: target.id,
    needIds: resolveCandidateNeedIds(input.needIds, category, session.mission, target),
    name: requiredText(input.name, 'name'),
    brand: optionalText(input.brand, 120),
    retailer,
    retailerId,
    retailerLogo: knownRetailer?.logo ?? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsedUrl.origin)}&sz=128`,
    category,
    shoppingDepartment,
    ...prices,
    image,
    imageWidth,
    imageHeight,
    url: canonicalUrl,
    colors: [],
    sizes: [],
    styleTags: [],
    occasionTags: [],
    source: 'agent',
    stage: 'candidate',
    availability: 'unknown',
    observedAt: now,
    relevanceScore: 0,
  }
  validateHardConstraints(product, session)
  return product
}

export function applyProductEnrichment(
  current: Product,
  input: ProductEnrichmentInput,
  session: SearchSession,
): Product {
  const category = input.category ?? current.category
  if (category !== undefined && !categoryIds.has(category)) throw new Error('Unsupported category.')
  const shoppingDepartment = input.shoppingDepartment ?? current.shoppingDepartment
  if (shoppingDepartment !== undefined && !departmentIds.has(shoppingDepartment)) throw new Error('Unsupported shoppingDepartment.')
  const availability = input.availability ?? current.availability
  if (!availabilityIds.has(availability)) throw new Error('Unsupported availability.')
  const styleTags = cleanStringList(input.styleTags, 'styleTags', 8)?.filter(tag => styleIds.has(tag)) ?? current.styleTags
  const occasionTags = cleanStringList(input.occasionTags, 'occasionTags', 8)?.filter(tag => occasionIds.has(tag)) ?? current.occasionTags
  const prices = input.nativePrice !== undefined || input.nativeCurrency !== undefined || input.priceCad !== undefined
    ? normalizePrices({
        nativePrice: input.nativePrice ?? current.nativePrice,
        nativeCurrency: input.nativeCurrency ?? current.nativeCurrency,
        priceCad: input.priceCad ?? current.priceCad,
      }, session.mission.constraints.maxPriceCad)
    : { nativePrice: current.nativePrice, nativeCurrency: current.nativeCurrency, priceCad: current.priceCad }
  const imageWidth = input.imageWidth !== undefined ? positiveNumber(input.imageWidth, 'imageWidth') : current.imageWidth
  const imageHeight = input.imageHeight !== undefined ? positiveNumber(input.imageHeight, 'imageHeight') : current.imageHeight
  if ((imageWidth === undefined) !== (imageHeight === undefined)) throw new Error('imageWidth and imageHeight must be provided together.')
  const product: Product = {
    ...current,
    name: optionalText(input.name, 220) ?? current.name,
    brand: input.brand !== undefined ? optionalText(input.brand, 120) : current.brand,
    category,
    shoppingDepartment,
    ...prices,
    image: input.image !== undefined ? optionalHttpUrl(input.image, 'image') : current.image,
    imageWidth,
    imageHeight,
    colors: cleanStringList(input.colors, 'colors') ?? current.colors,
    sizes: cleanStringList(input.sizes, 'sizes') ?? current.sizes,
    styleTags: styleTags as Product['styleTags'],
    occasionTags: occasionTags as Product['occasionTags'],
    description: input.description !== undefined ? optionalText(input.description, 800) : current.description,
    material: input.material !== undefined ? optionalText(input.material, 240) : current.material,
    availability,
    stage: 'enriched',
  }
  if (!product.needIds.length && product.category) {
    const target = session.targets.find(candidate => candidate.id === current.targetId)
    if (target) product.needIds = resolveCandidateNeedIds(undefined, product.category, session.mission, target)
  }
  validateHardConstraints(product, session)
  return product
}

export function mergeCandidate(existing: Product, incoming: Product): Product {
  return {
    ...existing,
    ...incoming,
    brand: incoming.brand ?? existing.brand,
    category: incoming.category ?? existing.category,
    shoppingDepartment: incoming.shoppingDepartment ?? existing.shoppingDepartment,
    nativePrice: incoming.nativePrice ?? existing.nativePrice,
    nativeCurrency: incoming.nativeCurrency ?? existing.nativeCurrency,
    priceCad: incoming.priceCad ?? existing.priceCad,
    image: incoming.image ?? existing.image,
    imageWidth: incoming.imageWidth ?? existing.imageWidth,
    imageHeight: incoming.imageHeight ?? existing.imageHeight,
    colors: existing.colors,
    sizes: existing.sizes,
    styleTags: existing.styleTags,
    occasionTags: existing.occasionTags,
    description: existing.description,
    material: existing.material,
    stage: existing.stage,
    availability: existing.availability,
    needIds: [...new Set([...existing.needIds, ...incoming.needIds])],
  }
}
