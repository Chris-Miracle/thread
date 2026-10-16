import { retailerForDomain } from '~/data/retailers'
import { needStoreDomains } from '~/domain/search/stores'
import { searchPriceCapCad } from '~/domain/search/priceModel'
import { STYLE_OPTIONS } from '~/types/thread'
import type {
  MissionNeed, ProductCategory, SearchMission, ShopCatalogQuery, ShopCatalogRequest, ShoppingDepartment, SimilaritySeed, StyleProfile,
} from '~/types/thread'

export const SHOP_CATALOG_PAGE_SIZE = 10
export const SHOP_REQUESTS_PER_TARGET = 3
export const SHOP_LOGO = 'https://www.google.com/s2/favicons?domain_url=https://shop.app&sz=128'

// Shop attribute values are exact: `Women` silently returns nothing, so departments map to Shop's own labels.
const TARGET_GENDER_VALUES: Record<ShoppingDepartment, string[] | undefined> = {
  women: ['Female', 'Unisex'],
  men: ['Male', 'Unisex'],
  all: undefined,
}

// Merchants label the same size differently ("M" vs "Medium"); Shop ORs values within one attribute.
const SIZE_SYNONYMS: Record<string, string[]> = {
  XXS: ['XXS', '2XS', 'Extra Extra Small'],
  XS: ['XS', 'Extra Small'],
  S: ['S', 'Small'],
  M: ['M', 'Medium'],
  L: ['L', 'Large'],
  XL: ['XL', 'Extra Large'],
  XXL: ['XXL', '2XL', 'Extra Extra Large'],
}

const SIZED_CATEGORIES = new Set<ProductCategory>(['tops', 'bottoms', 'dresses', 'outerwear', 'footwear'])

export function targetGenderValues(department: ShoppingDepartment): string[] | undefined {
  const values = TARGET_GENDER_VALUES[department]
  return values ? [...values] : undefined
}

export function sizeFilterValues(size: string): string[] {
  const normalized = size.trim().toUpperCase().replace(/\s+/g, '')
  return [...(SIZE_SYNONYMS[normalized] ?? [size.trim()])]
}

/** Whether a merchant size label is the saved size: "Large (L)", "L" and "Large" all match L; numeric sizes match exactly. */
export function matchesSavedSize(label: string, size: string): boolean {
  const wanted = sizeFilterValues(size).map(value => value.toLowerCase())
  const value = label.trim().toLowerCase()
  const inner = value.match(/\(([^)]+)\)/)?.[1]?.trim()
  const outer = value.replace(/\([^)]*\)/g, '').trim()
  return [value, inner, outer].some(candidate => candidate !== undefined && wanted.includes(candidate))
}

/** A profile size narrows a need only when that need asks for exactly one sized category. */
export function profileSizeForNeed(need: MissionNeed, profile: StyleProfile | null): string | undefined {
  if (!profile || need.categories.length !== 1) return undefined
  const category = need.categories[0]!
  if (!SIZED_CATEGORIES.has(category)) return undefined
  if (category === 'footwear') return profile.shoeSize
  return profile.clothingSizes?.[category as keyof NonNullable<StyleProfile['clothingSizes']>]
}

const MAX_INTENT_LENGTH = 200

/**
 * Shop's `context.intent` relevance hint: the trip, the person's styles, and what a reference image shows.
 * It ranks results without narrowing them, so it carries soft preferences that must not become filters.
 */
export function shopIntent(mission: SearchMission | undefined): string | undefined {
  if (!mission) return undefined
  const parts: string[] = []
  const { destination, tripType, climateHints, visualGuide } = mission.context
  if (destination || tripType) {
    const climate = climateHints.find(hint => ['hot', 'cold', 'mild'].includes(hint))
    parts.push(`${tripType ?? 'trip'}${destination ? ` in ${destination}` : ''}${climate ? `, ${climate} weather` : ''}`)
  }
  const styles = mission.stylePreferences
    .map(style => STYLE_OPTIONS.find(option => option.id === style)?.label.toLowerCase())
    .filter(Boolean)
  if (styles.length) parts.push(`style: ${styles.slice(0, 4).join(', ')}`)
  if (mission.context.occasions.length) parts.push(`occasion: ${mission.context.occasions.join(', ')}`)
  const cues = [...(visualGuide?.palette ?? []), ...(visualGuide?.descriptors ?? [])]
  if (cues.length) parts.push(`like the reference photo: ${cues.slice(0, 6).join(', ')}`)
  return parts.length ? parts.join('; ').slice(0, MAX_INTENT_LENGTH) : undefined
}

/** Rove compares prices in CAD only, so the currency stays CAD even when delivery is elsewhere. */
export function shopContext(profile: StyleProfile | null = null, mission?: SearchMission): ShopCatalogQuery['context'] {
  const destination = profile?.destination
  const intent = shopIntent(mission)
  return {
    address_country: destination?.country ?? 'CA',
    ...(destination?.region ? { address_region: destination.region } : {}),
    currency: 'CAD',
    ...(intent ? { intent } : {}),
  }
}

/** Per-item Shop price cap: a stated cap, or generous headroom over the item's share of the basket budget. */
function budgetMinorUnits(need: MissionNeed, mission: SearchMission): number | undefined {
  const cap = searchPriceCapCad(need, mission.constraints.maxPriceCad)
  return cap === undefined ? undefined : Math.round(cap * 100)
}

function shopDomains(need: MissionNeed, mission: SearchMission): string[] | undefined {
  const all = [...new Set(needStoreDomains(need, mission).map(domain => retailerForDomain(domain)?.domains[0] ?? domain))]
  return all.length ? all : undefined
}

export function buildCatalogFilters(
  need: MissionNeed,
  mission: SearchMission,
  profile: StyleProfile | null,
): ShopCatalogQuery['filters'] {
  const attributes: Array<{ name: string; values: string[] }> = []
  const gender = targetGenderValues(mission.shoppingDepartment)
  if (gender) attributes.push({ name: 'Target gender', values: gender })
  const size = profileSizeForNeed(need, profile)
  if (size) attributes.push({ name: 'Size', values: sizeFilterValues(size) })
  const max = budgetMinorUnits(need, mission)
  const shops = shopDomains(need, mission)
  const filters: NonNullable<ShopCatalogQuery['filters']> = {}
  if (max !== undefined) filters.price = { max }
  if (attributes.length) filters.attributes = attributes
  if (shops) filters.shops = shops
  return Object.keys(filters).length ? filters : undefined
}

export function buildCatalogRequests(
  need: MissionNeed,
  mission: SearchMission,
  profile: StyleProfile | null,
): ShopCatalogRequest[] {
  const filters = buildCatalogFilters(need, mission, profile)
  return [...new Set(need.queries.map(query => query.trim()).filter(Boolean))]
    .slice(0, SHOP_REQUESTS_PER_TARGET)
    .map(query => ({
      tool: 'search_catalog' as const,
      arguments: {
        catalog: {
          query,
          context: shopContext(profile, mission),
          ...(filters ? { filters } : {}),
          pagination: { limit: SHOP_CATALOG_PAGE_SIZE },
        },
      },
    }))
}

/** Shop `like` takes raw image bytes, so the data URL prefix is removed. */
export function imageLikeEntry(imageData: string) {
  const match = imageData.match(/^data:(image\/[a-z]+);base64,(.+)$/)
  if (!match) throw new Error('Inspiration image data must be a base64 data URL.')
  return { image: { content_type: match[1]!, data: match[2]! } }
}

export function buildSimilarityRequests(
  seed: SimilaritySeed,
  need: MissionNeed,
  mission: SearchMission,
  profile: StyleProfile | null,
  imageData?: string,
): ShopCatalogRequest[] {
  const filters = buildCatalogFilters(need, mission, profile)
  const request = (catalog: Pick<ShopCatalogQuery, 'query' | 'like'>): ShopCatalogRequest => ({
    tool: 'search_catalog',
    arguments: {
      catalog: {
        ...catalog,
        context: shopContext(profile, mission),
        ...(filters ? { filters } : {}),
        pagination: { limit: SHOP_CATALOG_PAGE_SIZE },
      },
    },
  })
  if (seed.kind === 'product') {
    return [seed.shopProductId ? request({ like: [{ id: seed.shopProductId }] }) : request({ query: seed.name })]
  }
  // A mission's guide image searches once per need, so the query keeps "like this photo" inside the right category.
  const query = isGuideSeed(seed, mission) ? need.queries[0] : undefined
  if (imageData) return [request({ like: [imageLikeEntry(imageData)], ...(query ? { query } : {}) })]
  if (query) return [request({ query })]
  return seed.note ? [request({ query: seed.note })] : []
}

export function isGuideSeed(seed: SimilaritySeed, mission: SearchMission): boolean {
  return seed.kind === 'image' && seed.inspirationId === mission.context.visualGuide?.inspirationId
}

/** Needs a reference image can guide: anything worn. A photo says nothing useful about a perfume. */
export function visualNeeds(mission: SearchMission): MissionNeed[] {
  return mission.needs.filter(need => !need.categories.length || need.categories.some(category => category !== 'fragrance'))
}
