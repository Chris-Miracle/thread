import { canonicalizeProductUrl } from '~/domain/productIdentity'
import type {
  Occasion, PriceTier, ProductCategory, RetailerAdapter, RetailerType, SearchMission,
  ShoppingDepartment, StyleId, StyleProfile,
} from '~/types/thread'

const APPAREL_CATEGORIES: ProductCategory[] = ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'activewear', 'swimwear']
const APPAREL_AND_FRAGRANCE: ProductCategory[] = [...APPAREL_CATEGORIES, 'fragrance']
const CORE_OCCASIONS: Occasion[] = ['dinner', 'work', 'casual', 'weekend', 'travel', 'vacation']

function logo(domain: string): string {
  return `https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128`
}

interface AdapterOptions {
  aliases?: string[]
  categories?: ProductCategory[]
  styles?: StyleId[]
  occasions?: Occasion[]
  priceTier?: PriceTier
  retailerType?: RetailerType
}

function adapter(
  id: string,
  name: string,
  domain: string,
  searchTemplate: string,
  departments: ShoppingDepartment[],
  tags: string[],
  options: AdapterOptions = {},
): RetailerAdapter {
  return {
    id,
    name,
    domains: [domain],
    logo: logo(domain),
    departments,
    tags,
    aliases: options.aliases ?? [],
    searchTemplate,
    capabilities: {
      categories: options.categories ?? APPAREL_CATEGORIES,
      styles: options.styles ?? [],
      occasions: options.occasions ?? CORE_OCCASIONS,
      priceTier: options.priceTier ?? 'mid',
      retailerType: options.retailerType ?? 'brand',
    },
  }
}

export const RETAILERS: RetailerAdapter[] = [
  adapter('fashion-nova', 'Fashion Nova', 'fashionnova.com', 'https://www.fashionnova.com/en-ca/pages/search-results?q={query}', ['women', 'men'], ['trend', 'party', 'denim'], { aliases: ['fashionnova'], styles: ['y2k', 'streetwear'], occasions: ['party', 'date-night', 'casual'], priceTier: 'value' }),
  adapter('shein', 'SHEIN', 'ca.shein.com', 'https://ca.shein.com/pdsearch/{query}/', ['women', 'men'], ['value', 'trend', 'wide-selection'], { styles: ['y2k', 'streetwear'], occasions: ['casual', 'party', 'vacation'], priceTier: 'value', retailerType: 'marketplace' }),
  adapter('oh-polly', 'Oh Polly', 'us.ohpolly.com', 'https://us.ohpolly.com/search?q={query}', ['women'], ['occasion', 'party', 'dresses'], { aliases: ['ohpolly'], categories: ['dresses', 'tops', 'bottoms', 'swimwear'], styles: ['smart-casual', 'y2k'], occasions: ['party', 'date-night', 'dinner', 'vacation'], priceTier: 'mid', retailerType: 'specialist' }),
  adapter('gymshark', 'Gymshark', 'ca.gymshark.com', 'https://ca.gymshark.com/search?q={query}', ['women', 'men'], ['activewear', 'training'], { categories: ['activewear', 'tops', 'bottoms', 'accessories'], styles: ['sporty', 'minimal'], occasions: ['training', 'casual', 'travel'], priceTier: 'mid', retailerType: 'specialist' }),
  adapter('zara', 'Zara', 'zara.com', 'https://www.zara.com/ca/en/search?searchTerm={query}', ['women', 'men'], ['editorial', 'trend'], { categories: APPAREL_AND_FRAGRANCE, styles: ['minimal', 'smart-casual', 'classic'], occasions: ['dinner', 'work', 'casual', 'vacation'], priceTier: 'mid' }),
  adapter('hm', 'H&M', 'www2.hm.com', 'https://www2.hm.com/en_ca/search-results.html?q={query}', ['women', 'men'], ['value', 'basics'], { aliases: ['h and m'], categories: APPAREL_AND_FRAGRANCE, styles: ['minimal', 'classic', 'streetwear'], occasions: CORE_OCCASIONS, priceTier: 'value', retailerType: 'department' }),
  adapter('uniqlo', 'UNIQLO', 'uniqlo.com', 'https://www.uniqlo.com/ca/en/search?q={query}', ['women', 'men', 'all'], ['minimal', 'basics'], { styles: ['minimal', 'classic', 'smart-casual'], occasions: ['work', 'casual', 'travel', 'vacation'], priceTier: 'value' }),
  adapter('cos', 'COS', 'cos.com', 'https://www.cos.com/en-ca/search?q={query}', ['women', 'men'], ['minimal', 'modern'], { styles: ['minimal', 'smart-casual', 'avant-garde'], occasions: ['work', 'dinner', 'casual', 'vacation'], priceTier: 'premium' }),
  adapter('asos', 'ASOS', 'asos.com', 'https://www.asos.com/search/?q={query}', ['women', 'men'], ['wide-selection', 'trend'], { categories: APPAREL_AND_FRAGRANCE, styles: ['streetwear', 'smart-casual', 'y2k'], occasions: ['party', 'date-night', 'casual', 'vacation'], priceTier: 'mid', retailerType: 'marketplace' }),
  adapter('aritzia', 'Aritzia', 'aritzia.com', 'https://www.aritzia.com/en/search?q={query}', ['women'], ['minimal', 'premium'], { styles: ['minimal', 'smart-casual', 'classic'], occasions: ['work', 'dinner', 'casual', 'vacation'], priceTier: 'premium' }),
  adapter('abercrombie', 'Abercrombie', 'abercrombie.com', 'https://www.abercrombie.com/shop/ca/search?searchTerm={query}', ['women', 'men'], ['casual', 'classic'], { aliases: ['abercrombie and fitch', 'a and f'], styles: ['classic', 'smart-casual', 'minimal'], occasions: ['casual', 'dinner', 'vacation', 'travel'], priceTier: 'mid' }),
  adapter('nike', 'Nike', 'nike.com', 'https://www.nike.com/ca/w?q={query}', ['women', 'men', 'all'], ['sport', 'footwear'], { categories: ['footwear', 'activewear', 'tops', 'bottoms', 'accessories'], styles: ['sporty', 'streetwear'], occasions: ['training', 'casual', 'travel'], priceTier: 'mid', retailerType: 'specialist' }),
  adapter('new-balance', 'New Balance', 'newbalance.ca', 'https://www.newbalance.ca/en_ca/search/?q={query}', ['women', 'men', 'all'], ['sport', 'footwear'], { aliases: ['newbalance'], categories: ['footwear', 'activewear', 'accessories'], styles: ['sporty', 'classic'], occasions: ['training', 'casual', 'travel'], priceTier: 'mid', retailerType: 'specialist' }),
  adapter('adidas', 'adidas', 'adidas.ca', 'https://www.adidas.ca/en/search?q={query}', ['women', 'men', 'all'], ['sport', 'streetwear'], { categories: ['footwear', 'activewear', 'tops', 'bottoms', 'accessories'], styles: ['sporty', 'streetwear'], occasions: ['training', 'casual', 'travel'], priceTier: 'mid', retailerType: 'specialist' }),
  adapter('mango', 'Mango', 'shop.mango.com', 'https://shop.mango.com/ca/en/search?kw={query}', ['women', 'men'], ['smart-casual', 'modern'], { styles: ['smart-casual', 'minimal', 'classic'], occasions: ['work', 'dinner', 'vacation', 'resort'], priceTier: 'mid' }),
  adapter('reformation', 'Reformation', 'thereformation.com', 'https://www.thereformation.com/search?q={query}', ['women'], ['occasion', 'premium'], { categories: ['dresses', 'tops', 'bottoms', 'footwear', 'swimwear'], styles: ['smart-casual', 'classic', 'old-money'], occasions: ['dinner', 'date-night', 'formal', 'vacation', 'resort'], priceTier: 'premium' }),
  adapter('meshki', 'MESHKI', 'meshki.com.au', 'https://www.meshki.com.au/search?q={query}', ['women'], ['occasion', 'party'], { categories: ['dresses', 'tops', 'bottoms', 'swimwear', 'accessories'], styles: ['smart-casual', 'y2k'], occasions: ['party', 'date-night', 'dinner', 'vacation'], priceTier: 'mid' }),
  adapter('princess-polly', 'Princess Polly', 'princesspolly.com', 'https://us.princesspolly.com/search?q={query}', ['women'], ['trend', 'party'], { aliases: ['princesspolly'], styles: ['y2k', 'streetwear'], occasions: ['party', 'casual', 'vacation', 'beach'], priceTier: 'mid' }),
  adapter('dynamite', 'Dynamite', 'dynamiteclothing.com', 'https://www.dynamiteclothing.com/ca/search?q={query}', ['women'], ['smart-casual', 'trend'], { styles: ['smart-casual', 'minimal'], occasions: ['work', 'dinner', 'casual', 'vacation'], priceTier: 'mid' }),
  adapter('garage', 'Garage', 'garageclothing.com', 'https://www.garageclothing.com/ca/search?q={query}', ['women'], ['casual', 'y2k'], { styles: ['y2k', 'streetwear'], occasions: ['casual', 'party', 'vacation'], priceTier: 'value' }),
  adapter('lululemon', 'lululemon', 'shop.lululemon.com', 'https://shop.lululemon.com/search?Ntt={query}', ['women', 'men', 'all'], ['activewear', 'premium'], { categories: ['activewear', 'tops', 'bottoms', 'outerwear', 'footwear', 'accessories', 'swimwear'], styles: ['sporty', 'minimal'], occasions: ['training', 'travel', 'casual', 'vacation'], priceTier: 'premium', retailerType: 'specialist' }),
  adapter('ssense', 'SSENSE', 'ssense.com', 'https://www.ssense.com/en-ca/search?q={query}', ['women', 'men'], ['designer', 'avant-garde'], { styles: ['avant-garde', 'streetwear', 'minimal'], occasions: ['dinner', 'party', 'formal', 'casual'], priceTier: 'luxury', retailerType: 'marketplace' }),
  adapter('simons', 'Simons', 'simons.ca', 'https://www.simons.ca/en/search--search?query={query}', ['women', 'men'], ['canadian', 'wide-selection'], { categories: APPAREL_AND_FRAGRANCE, styles: ['minimal', 'classic', 'smart-casual'], occasions: CORE_OCCASIONS, priceTier: 'mid', retailerType: 'department' }),
  adapter('oak-fort', 'OAK + FORT', 'oakandfort.com', 'https://oakandfort.com/search?q={query}', ['women', 'men', 'all'], ['minimal', 'modern'], { aliases: ['oak and fort', 'oak fort'], styles: ['minimal', 'smart-casual', 'avant-garde'], occasions: ['work', 'dinner', 'casual', 'vacation'], priceTier: 'mid' }),
  adapter('frank-and-oak', 'Frank And Oak', 'frankandoak.com', 'https://www.frankandoak.com/search?q={query}', ['women', 'men'], ['canadian', 'minimal'], { aliases: ['frank oak'], styles: ['minimal', 'classic', 'smart-casual'], occasions: ['work', 'casual', 'travel', 'vacation'], priceTier: 'mid' }),
  adapter('everlane', 'Everlane', 'everlane.com', 'https://www.everlane.com/search?q={query}', ['women', 'men'], ['minimal', 'basics'], { styles: ['minimal', 'classic', 'smart-casual'], occasions: ['work', 'casual', 'travel', 'vacation'], priceTier: 'premium' }),
  adapter('good-american', 'Good American', 'goodamerican.com', 'https://www.goodamerican.com/search?q={query}', ['women'], ['denim', 'curve', 'trend'], { aliases: ['goodamerican'], categories: ['bottoms', 'tops', 'dresses', 'swimwear', 'activewear'], styles: ['smart-casual', 'y2k'], occasions: ['casual', 'dinner', 'vacation'], priceTier: 'premium', retailerType: 'specialist' }),
  adapter('farfetch', 'FARFETCH', 'farfetch.com', 'https://www.farfetch.com/ca/shopping/search/items.aspx?q={query}', ['women', 'men'], ['designer', 'marketplace'], { categories: APPAREL_AND_FRAGRANCE, styles: ['avant-garde', 'old-money', 'streetwear'], occasions: ['dinner', 'formal', 'party', 'vacation'], priceTier: 'luxury', retailerType: 'marketplace' }),
  adapter('shopbop', 'Shopbop', 'shopbop.com', 'https://www.shopbop.com/actions/search/searchResultsAction.action?query={query}', ['women'], ['designer', 'wide-selection'], { aliases: ['shop bop'], styles: ['smart-casual', 'classic', 'old-money'], occasions: ['dinner', 'vacation', 'resort', 'formal'], priceTier: 'premium', retailerType: 'marketplace' }),
  adapter('revolve', 'REVOLVE', 'revolve.com', 'https://www.revolve.com/r/Search.jsp?search={query}', ['women', 'men'], ['trend', 'occasion', 'premium'], { styles: ['smart-casual', 'y2k'], occasions: ['party', 'date-night', 'vacation', 'resort'], priceTier: 'premium', retailerType: 'marketplace' }),
  adapter('holt-renfrew', 'Holt Renfrew', 'holtrenfrew.com', 'https://www.holtrenfrew.com/en/search?q={query}', ['women', 'men'], ['canadian', 'designer'], { aliases: ['holt renfrew'], categories: APPAREL_AND_FRAGRANCE, styles: ['old-money', 'classic', 'avant-garde'], occasions: ['formal', 'dinner', 'work', 'vacation'], priceTier: 'luxury', retailerType: 'department' }),
  adapter('saks', 'Saks Fifth Avenue', 'saksfifthavenue.com', 'https://www.saksfifthavenue.com/search?q={query}', ['women', 'men'], ['designer', 'premium'], { aliases: ['saks fifth avenue'], categories: APPAREL_AND_FRAGRANCE, styles: ['old-money', 'classic', 'avant-garde'], occasions: ['formal', 'dinner', 'work', 'vacation'], priceTier: 'luxury', retailerType: 'department' }),
]

export const RETAILER_BY_ID = new Map(RETAILERS.map(item => [item.id, item]))

function normalizedPhrase(value: string): string {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

export function retailerIdsMentionedIn(query: string, adapters: readonly RetailerAdapter[] = RETAILERS): string[] {
  const haystack = ` ${normalizedPhrase(query)} `
  return adapters
    .filter((retailer) => {
      const phrases = [retailer.name, retailer.id.replace(/-/g, ' '), ...retailer.aliases]
        .map(normalizedPhrase)
        .filter(phrase => phrase.length >= 3)
      return phrases.some(phrase => haystack.includes(` ${phrase} `))
    })
    .map(retailer => retailer.id)
}

function normalizedDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '')
}

export function retailerForDomain(domain: string): RetailerAdapter | undefined {
  const normalized = normalizedDomain(domain)
  return RETAILERS.find(retailer => retailer.domains.some((candidate) => {
    const known = normalizedDomain(candidate)
    return normalized === known || normalized.endsWith(`.${known}`)
  }))
}

export function buildRetailerSearchUrls(retailer: RetailerAdapter, mission: SearchMission, queries = mission.derivedQueries): string[] {
  return queries.slice(0, 6).map(query => retailer.searchTemplate.replace('{query}', encodeURIComponent(query.trim())))
}

export function isProductUrlForRetailer(retailer: RetailerAdapter, value: string): boolean {
  try {
    const canonical = new URL(canonicalizeProductUrl(value))
    const domainMatches = retailer.domains.some((domain) => {
      const known = normalizedDomain(domain)
      const actual = normalizedDomain(canonical.hostname)
      return actual === known || actual.endsWith(`.${known}`)
    })
    if (!domainMatches || canonical.pathname === '/' || canonical.pathname.length < 5) return false
    const searchLike = /(?:^|\/)(search|collections?|category|categories|shop-all)(?:\/|$)/i.test(canonical.pathname)
      || canonical.searchParams.has('q')
      || canonical.searchParams.has('query')
      || canonical.searchParams.has('searchTerm')
    return !searchLike
  } catch {
    return false
  }
}

const PRICE_TIER_CEILINGS: Record<PriceTier, number> = {
  value: 90,
  mid: 180,
  premium: 350,
  luxury: Number.POSITIVE_INFINITY,
}

function intersectionCount<T>(left: readonly T[], right: readonly T[]): number {
  const rightSet = new Set(right)
  return left.filter(item => rightSet.has(item)).length
}

export interface RankedRetailer {
  retailer: RetailerAdapter
  score: number
  reasons: string[]
}

export function rankRetailers(
  mission: SearchMission,
  profile: StyleProfile | null,
  adapters: readonly RetailerAdapter[] = RETAILERS,
): RankedRetailer[] {
  const allowed = new Set(mission.constraints.retailerIds)
  const excluded = new Set([...mission.constraints.excludedRetailerIds, ...(profile?.excludedRetailerIds ?? [])])
  const preferred = new Set(profile?.preferredRetailerIds ?? [])
  const missionCategories = mission.constraints.categories.length
    ? mission.constraints.categories
    : mission.needs.flatMap(need => need.categories)

  return adapters
    .filter(retailer => !allowed.size || allowed.has(retailer.id))
    .filter(retailer => !excluded.has(retailer.id))
    .filter(retailer => mission.shoppingDepartment === 'all'
      || retailer.departments.includes('all')
      || retailer.departments.includes(mission.shoppingDepartment))
    .map((retailer): RankedRetailer => {
      let score = 20
      const reasons: string[] = ['department supported']
      const categoryMatches = intersectionCount(retailer.capabilities.categories, missionCategories)
      const styleMatches = intersectionCount(retailer.capabilities.styles, mission.stylePreferences)
      const occasionMatches = intersectionCount(retailer.capabilities.occasions, mission.context.occasions)
      score += categoryMatches * 7
      score += styleMatches * 6
      score += occasionMatches * 5
      if (categoryMatches) reasons.push(`${categoryMatches} category match${categoryMatches === 1 ? '' : 'es'}`)
      if (styleMatches) reasons.push(`${styleMatches} style match${styleMatches === 1 ? '' : 'es'}`)
      if (occasionMatches) reasons.push(`${occasionMatches} occasion match${occasionMatches === 1 ? '' : 'es'}`)
      if (mission.constraints.maxPriceCad !== undefined) {
        const ceiling = PRICE_TIER_CEILINGS[retailer.capabilities.priceTier]
        const budgetCompatible = mission.constraints.maxPriceCad >= ceiling * 0.45
        score += budgetCompatible ? 6 : -8
        reasons.push(budgetCompatible ? 'budget compatible' : 'budget may be restrictive')
      }
      if (preferred.has(retailer.id)) {
        score += 14
        reasons.push('preferred retailer')
      }
      if (retailer.tags.includes('wide-selection')) score += 2
      if (mission.context.climateHints.some(hint => /hot|humid|tropical|warm/i.test(hint))
        && retailer.capabilities.occasions.some(occasion => occasion === 'vacation' || occasion === 'resort')) {
        score += 4
        reasons.push('warm-weather relevance')
      }
      return { retailer, score, reasons }
    })
    .sort((left, right) => right.score - left.score || left.retailer.id.localeCompare(right.retailer.id))
}
