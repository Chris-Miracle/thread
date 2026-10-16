import { matchesStore, needStoreDomains } from '~/domain/search/stores'
import { sameOptions } from '~/domain/cart/checkoutPlan'
import { RETAILER_BY_ID, isProductUrlForRetailer, retailerForDomain } from '~/data/retailers'
import { isColorOption, isSizeOption, variantColor, variantSize } from '~/domain/cart/checkoutPlan'
import { canonicalizeProductUrl, canonicalizeShopProductUrl, productIdFromUrl, stableHash } from '~/domain/productIdentity'
import { isDepartmentEligible } from '~/domain/research/scheduler'
import { resolveCandidateNeedIds } from '~/domain/research/fulfillment'
import {
  OCCASIONS, PRODUCT_AVAILABILITY, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type Product, type ProductAvailability, type ProductCandidateInput, type ProductCommerce, type ProductEnrichmentInput,
  type ProductVariant, type ResearchTarget, type SearchSession, type ShopCandidateInput, type ShopSelectedOption,
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
    throw new Error('Non-CAD listings require an explicitly verified priceCad; Rove does not guess exchange rates.')
  }
  if (maxPriceCad !== undefined) {
    if (priceCad === undefined) throw new Error('A verified priceCad is required to enforce this search budget.')
    if (priceCad > maxPriceCad) throw new Error(`Product exceeds the mission budget of CAD ${maxPriceCad.toFixed(2)}.`)
  }
  return { nativePrice, nativeCurrency, priceCad }
}

/** Shop prices are integer minor units; the currency's own decimal places decide the conversion. */
export function fromMinorUnits(amount: number, currency: string): number {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('shop.price.amount must be a positive integer in minor units.')
  const code = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('shop.price.currency must be a three-letter ISO code.')
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2
  return amount / 10 ** digits
}

function normalizeShopProvenance(shop: ShopCandidateInput | undefined, exactUrl: string): ProductCommerce {
  if (!shop || typeof shop !== 'object') throw new Error('Shop catalogue candidates must include shop provenance from search_catalog.')
  const productId = requiredText(shop.productId, 'shop.productId', 200)
  if (!productId.startsWith('gid://shopify/')) throw new Error('shop.productId must be the returned Shopify product ID.')
  const variantId = optionalText(shop.variantId, 200)
  if (variantId && !variantId.startsWith('gid://shopify/ProductVariant/')) throw new Error('shop.variantId must be the returned Shopify variant ID.')
  const selectedOptions = (shop.selectedOptions ?? []).slice(0, 6).map((option, index) => ({
    name: requiredText(option?.name, `shop.selectedOptions[${index}].name`, 60),
    label: requiredText(option?.label, `shop.selectedOptions[${index}].label`, 80),
  }))
  return {
    provider: 'shop',
    productId,
    variantId,
    sellerDomain: requiredText(shop.sellerDomain, 'shop.sellerDomain', 200).toLowerCase(),
    sellerId: optionalText(shop.sellerId, 200),
    sellerName: optionalText(shop.sellerName, 100),
    sellerUrl: optionalHttpUrl(shop.sellerUrl, 'shop.sellerUrl'),
    url: exactUrl,
    selectedOptions,
    checkoutUrl: checkoutUrl(shop.checkoutUrl),
  }
}


function checkoutUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Shop checkout URL must be an HTTPS URL without credentials.')
  return value
}

const MAX_PRODUCT_VARIANTS = 100

function normalizeVariant(input: {
  id: unknown
  options?: readonly ShopSelectedOption[]
  available?: unknown
  price?: { amount: number; currency: string }
  priceCad?: number
  checkoutUrl?: string
  url?: string
}, label: string): ProductVariant {
  const id = requiredText(input.id, `${label}.id`, 200)
  if (!id.startsWith('gid://shopify/ProductVariant/')) throw new Error(`${label}.id must be the returned Shopify variant ID.`)
  const options = (input.options ?? []).slice(0, 6).map((option, index) => ({
    name: requiredText(option?.name, `${label}.options[${index}].name`, 60),
    label: requiredText(option?.label, `${label}.options[${index}].label`, 80),
  }))
  if (new Set(options.map(option => option.name)).size !== options.length) throw new Error('Variant option names must be unique.')
  if (typeof input.available !== 'boolean') throw new Error(`${label}.available must be a boolean.`)
  if (input.price) {
    const amount = fromMinorUnits(input.price.amount, input.price.currency)
    if (input.price.currency.toUpperCase() === 'CAD' && input.priceCad !== undefined && Math.abs(input.priceCad - amount) > 0.001) throw new Error('Variant priceCad must match its returned CAD price.')
  }
  return {
    id,
    options,
    size: variantSize(options),
    color: variantColor(options),
    available: input.available,
    priceMinor: input.price?.amount,
    currency: input.price?.currency.trim().toUpperCase(),
    priceCad: input.price?.currency.toUpperCase() === 'CAD' ? fromMinorUnits(input.price.amount, 'CAD') : positiveNumber(input.priceCad, 'variant.priceCad'),
    checkoutUrl: checkoutUrl(input.checkoutUrl),
    url: input.url === undefined ? undefined : (optionalHttpUrl(input.url, 'variant.url') && input.url),
  }
}

function mergeVariants(existing: readonly ProductVariant[] | undefined, incoming: readonly ProductVariant[] | undefined): ProductVariant[] | undefined {
  if (!existing?.length && !incoming?.length) return undefined
  const byId = new Map((existing ?? []).map(variant => [variant.id, variant]))
  for (const variant of incoming ?? []) byId.set(variant.id, variant)
  return [...byId.values()].slice(0, MAX_PRODUCT_VARIANTS)
}

/**
 * Every size and colour a listing is offered in: Shop's product.options plus its featured variant, or the lists a
 * retailer page shows. These are what the person can choose from; per-variant stock is still verified at enrichment.
 */
function offeredOptions(input: ProductCandidateInput): { sizes: string[]; colors: string[] } {
  const options = (input.shop?.options ?? []).slice(0, 12).map((option, index) => {
    const name = requiredText(option?.name, `shop.options[${index}].name`, 60)
    if (!Array.isArray(option.values)) throw new Error(`shop.options[${index}].values must be an array.`)
    return { name, labels: option.values.slice(0, 60).map((value, valueIndex) => requiredText(value?.label, `shop.options[${index}].values[${valueIndex}].label`, 80)) }
  })
  const featured = input.shop?.selectedOptions ?? []
  const sizes = [
    ...options.filter(option => isSizeOption(option.name)).flatMap(option => option.labels),
    ...(variantSize(featured) ? [variantSize(featured)!] : []),
    ...(cleanStringList(input.sizes, 'sizes', 60) ?? []),
  ]
  const colors = [
    ...options.filter(option => isColorOption(option.name)).flatMap(option => option.labels),
    ...(variantColor(featured) ? [variantColor(featured)!] : []),
    ...(cleanStringList(input.colors, 'colors', 60) ?? []),
  ]
  return { sizes: [...new Set(sizes)], colors: [...new Set(colors)] }
}

function shopAvailability(shop: ShopCandidateInput | undefined): ProductAvailability {
  if (shop?.available === true) return 'in-stock'
  if (shop?.available === false) return 'out-of-stock'
  return 'unknown'
}

function isUnknownProductUrl(url: URL): boolean {
  if (url.pathname === '/' || url.pathname.length < 5) return false
  if (/(?:^|\/)(search|collections?|category|categories|shop-all)(?:\/|$)/i.test(url.pathname)) return false
  return !url.searchParams.has('q') && !url.searchParams.has('query') && !url.searchParams.has('searchTerm')
}

function validateHardConstraints(product: Pick<Product, 'retailerId' | 'category' | 'shoppingDepartment' | 'priceCad'>, session: SearchSession): void {
  const constraints = session.mission.constraints
  if (!session.mission.needs.some(need => need.retailerIds !== undefined || need.storeDomains !== undefined)
    && constraints.retailerIds.length && !constraints.storeDomains?.length && !constraints.retailerIds.includes(product.retailerId)) {
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
  const exactUrl = requiredText(input.url, 'url', 2_000)
  const fromCatalog = target.sourceType === 'catalog'
  if (input.shop !== undefined && !fromCatalog) throw new Error('shop provenance is accepted only on Shop catalogue targets.')
  const canonicalUrl = fromCatalog ? canonicalizeShopProductUrl(exactUrl) : canonicalizeProductUrl(exactUrl)
  const commerce = fromCatalog ? normalizeShopProvenance(input.shop, optionalHttpUrl(exactUrl, 'url')!) : undefined
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
  if (!knownRetailer && (target.sourceType === 'retailer' || !isUnknownProductUrl(parsedUrl))) {
    throw new Error('Unknown retailer products are accepted only from discovery or Shop catalogue targets with a canonical product-like URL.')
  }

  const category = input.category
  if (category === 'fragrance' && /\b(?:body wash|hand wash|shower gel|soap|body lotion|candle|diffuser)\b/i.test(input.name)) throw new Error('This product is not a personal perfume or cologne; do not classify bath or home products as fragrance.')
  if (category !== undefined && !categoryIds.has(category)) throw new Error('Unsupported category.')
  const shoppingDepartment = input.shoppingDepartment
  if (shoppingDepartment !== undefined && !departmentIds.has(shoppingDepartment)) throw new Error('Unsupported shoppingDepartment.')
  const image = optionalHttpUrl(input.image, 'image')
  if (!image) throw new Error('image is required. Publish a direct product image URL from the retailer page.')
  if (image === canonicalUrl) throw new Error('image must be a direct product image URL, not the product page URL.')
  const imageWidth = positiveNumber(input.imageWidth, 'imageWidth')
  const imageHeight = positiveNumber(input.imageHeight, 'imageHeight')
  if ((imageWidth === undefined) !== (imageHeight === undefined)) throw new Error('imageWidth and imageHeight must be provided together.')
  const shopPrice = input.shop?.price
    ? { nativePrice: fromMinorUnits(input.shop.price.amount, input.shop.price.currency), nativeCurrency: input.shop.price.currency.trim().toUpperCase() }
    : {}
  if (input.shop?.price && input.nativePrice !== undefined && input.nativePrice !== shopPrice.nativePrice) throw new Error('nativePrice must match the returned Shop price.')
  if (shopPrice.nativeCurrency && shopPrice.nativeCurrency !== 'CAD' && input.priceCad === undefined) {
    throw new Error(`Shop returned this offer in ${shopPrice.nativeCurrency} ${shopPrice.nativePrice!.toFixed(2)}, not CAD. Rove converts minor units but never guesses exchange rates: publish it again with priceCad taken from a CAD price shown by the seller, or skip this offer.`)
  }
  const prices = normalizePrices({ ...input, ...shopPrice }, session.mission.constraints.maxPriceCad)
  const retailerId = knownRetailer?.id ?? `retailer:${stableHash(normalizedHostname)}`
  const retailer = knownRetailer?.name ?? commerce?.sellerName ?? optionalText(input.retailer, 100) ?? normalizedHostname
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
    ...offeredOptions(input),
    styleTags: [],
    occasionTags: [],
    source: 'agent',
    stage: 'candidate',
    availability: shopAvailability(input.shop),
    observedAt: now,
    relevanceScore: 0,
    ...(commerce ? { commerce } : {}),
    ...(commerce?.variantId
      ? {
          variants: [normalizeVariant({
            id: commerce.variantId,
            options: commerce.selectedOptions,
            available: input.shop?.available === true,
            price: input.shop?.price,
            priceCad: prices.priceCad,
            checkoutUrl: commerce.checkoutUrl,
            url: commerce.url,
          }, 'shop.variant')],
        }
      : {}),
  }
  const eligibleNeeds = product.needIds.filter(id => {
    const need = session.mission.needs.find(need => need.id === id)!
    const domains = needStoreDomains(need, session.mission)
    return !domains.length || matchesStore(canonicalUrl, domains) || Boolean(commerce?.sellerUrl && matchesStore(commerce.sellerUrl, domains))
  })
  if (product.needIds.length && !eligibleNeeds.length) throw new Error('Product seller or price is outside the requested store restriction or need budget.')
  if (input.needIds?.some(id => !eligibleNeeds.includes(id))) throw new Error('Product does not meet its assigned need store restriction or budget.')
  product.needIds = eligibleNeeds
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
  const prices = !current.commerce && (input.nativePrice !== undefined || input.nativeCurrency !== undefined || input.priceCad !== undefined)
    ? normalizePrices({
        nativePrice: input.nativePrice ?? current.nativePrice,
        nativeCurrency: input.nativeCurrency ?? current.nativeCurrency,
        priceCad: input.priceCad ?? current.priceCad,
      }, session.mission.constraints.maxPriceCad)
    : { nativePrice: current.nativePrice, nativeCurrency: current.nativeCurrency, priceCad: current.priceCad }
  if (input.variants !== undefined && !current.commerce) throw new Error('variants are accepted only for Shop catalogue products.')
  const incomingVariants = input.variants?.slice(0, MAX_PRODUCT_VARIANTS).map((variant, index) => normalizeVariant(variant, `variants[${index}]`))
  for (const variant of incomingVariants ?? []) {
    const previous = current.variants?.find(candidate => candidate.id === variant.id)
    variant.url ??= previous?.url
    variant.checkoutUrl ??= previous?.checkoutUrl
  }
  if (current.commerce) {
    if (input.shopProductId && input.shopProductId !== current.commerce.productId) throw new Error('Shop returned a different product. Do not substitute it.')
    if (!incomingVariants?.length) throw new Error('Shop enrichment requires the exact returned variants with stock and price.')
    const expected = input.requestedOptions ?? current.commerce.selectedOptions
    if (incomingVariants.length !== 1 || !sameOptions(incomingVariants[0]!.options, expected)) {
      throw new Error('Shop returned different options from those requested. Do not substitute them; verify the exact selection again.')
    }
    const selected = incomingVariants[0]!
    if (selected.url && canonicalizeShopProductUrl(selected.url) !== canonicalizeShopProductUrl(current.url)) throw new Error('Shop variant URL belongs to a different product.')
    if (selected.priceMinor === undefined || !selected.currency) {
      const previous = current.variants?.find(variant => variant.id === selected.id)
      if (!previous?.priceMinor || !previous.currency) throw new Error('The exact Shop variant requires a verified price and currency.')
      selected.priceMinor = previous.priceMinor
      selected.currency = previous.currency
      selected.priceCad = previous.priceCad
    }
    const verified = normalizePrices({ nativePrice: fromMinorUnits(selected.priceMinor!, selected.currency!), nativeCurrency: selected.currency, priceCad: selected.priceCad ?? input.priceCad }, session.mission.constraints.maxPriceCad)
    if (input.priceCad !== undefined && input.priceCad !== verified.priceCad) throw new Error('priceCad must match the returned exact variant price.')
    if (input.nativePrice !== undefined && input.nativePrice !== verified.nativePrice) throw new Error('nativePrice must match the returned exact variant price.')
    if (input.nativeCurrency !== undefined && input.nativeCurrency.toUpperCase() !== verified.nativeCurrency) throw new Error('nativeCurrency must match the returned exact variant currency.')
    selected.priceCad = verified.priceCad
    Object.assign(prices, verified)
  }
  const variants = mergeVariants(current.variants, incomingVariants)
  const variantSizes = (incomingVariants ?? []).map(variant => variant.size).filter((value): value is string => Boolean(value))
  const variantColors = (incomingVariants ?? []).map(variant => variant.color).filter((value): value is string => Boolean(value))
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
    colors: [...new Set([...(cleanStringList(input.colors, 'colors') ?? current.colors), ...variantColors])],
    sizes: [...new Set([...(cleanStringList(input.sizes, 'sizes') ?? current.sizes), ...variantSizes])],
    ...(variants ? { variants } : {}),
    ...(current.commerce && incomingVariants?.[0] ? { commerce: { ...current.commerce, selectedOptions: incomingVariants[0].options.map(option => ({ ...option })), variantId: incomingVariants[0].id, checkoutUrl: incomingVariants[0].checkoutUrl, url: incomingVariants[0].url ?? current.commerce.url } } : {}),
    styleTags: styleTags as Product['styleTags'],
    occasionTags: occasionTags as Product['occasionTags'],
    description: input.description !== undefined ? optionalText(input.description, 800) : current.description,
    material: input.material !== undefined ? optionalText(input.material, 240) : current.material,
    availability: current.commerce && incomingVariants?.[0] ? (incomingVariants[0].available ? 'in-stock' : 'out-of-stock') : availability,
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
    // Enrichment owns verified options; until then a later listing may reveal more sizes or colours.
    colors: existing.stage === 'enriched' ? existing.colors : [...new Set([...existing.colors, ...incoming.colors])],
    sizes: existing.stage === 'enriched' ? existing.sizes : [...new Set([...existing.sizes, ...incoming.sizes])],
    styleTags: existing.styleTags,
    occasionTags: existing.occasionTags,
    description: existing.description,
    material: existing.material,
    stage: existing.stage,
    availability: existing.stage === 'enriched' || incoming.availability === 'unknown' ? existing.availability : incoming.availability,
    needIds: [...new Set([...existing.needIds, ...incoming.needIds])],
    commerce: existing.commerce ?? incoming.commerce,
    variants: mergeVariants(existing.variants, incoming.variants),
  }
}
