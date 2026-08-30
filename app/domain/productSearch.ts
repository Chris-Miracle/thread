import type { Occasion, Product, ProductCategory, ProductSearchInput, ShoppingGender, StyleId } from '~/types/thread'

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'give', 'going', 'i', 'im', 'in', 'is', 'me', 'my', 'of', 'outfit', 'please', 'something', 'the', 'this', 'to', 'want'])

const OCCASION_TERMS: Record<Occasion, string[]> = {
  dinner: ['dinner', 'restaurant', 'supper'],
  'date-night': ['date', 'romantic', 'evening'],
  work: ['work', 'office', 'meeting', 'professional'],
  casual: ['casual', 'everyday', 'relaxed'],
  weekend: ['weekend', 'saturday', 'sunday'],
  party: ['party', 'club', 'celebration'],
  formal: ['formal', 'wedding', 'gala', 'ceremony'],
  travel: ['travel', 'flight', 'airport', 'vacation'],
  training: ['training', 'gym', 'lifting', 'workout', 'running', 'pilates'],
}

const CATEGORY_TERMS: Record<ProductCategory, string[]> = {
  tops: ['top', 'shirt', 'tee', 't-shirt', 'polo', 'blouse', 'knit', 'tank', 'cardigan', 'vest'],
  bottoms: ['bottom', 'pants', 'trousers', 'jeans', 'chinos', 'skirt', 'cargo'],
  dresses: ['dress', 'dresses', 'mini', 'midi', 'maxi'],
  outerwear: ['outerwear', 'coat', 'jacket', 'bomber', 'parka', 'trench'],
  footwear: ['footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'loafer', 'loafers', 'derby', 'heel', 'runner'],
  accessories: ['accessory', 'accessories', 'bag', 'belt', 'cuff', 'sunglasses', 'cap', 'clutch'],
  activewear: ['activewear', 'gym', 'legging', 'leggings', 'sports', 'workout', 'training'],
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9-]+/g, ' ').trim()
}

function tokens(value: string): string[] {
  return [...new Set(normalize(value).split(/\s+/).filter(token => token.length > 1 && !STOP_WORDS.has(token)))]
}

export function inferMaxPrice(query: string): number | undefined {
  const match = normalize(query).match(/(?:under|below|less than|max|maximum|up to)\s*\$?\s*(\d+(?:\.\d+)?)/)
  return match?.[1] ? Number(match[1]) : undefined
}

function inferOccasion(query: string): Occasion | undefined {
  const normalized = normalize(query)
  return (Object.entries(OCCASION_TERMS) as [Occasion, string[]][])
    .find(([, terms]) => terms.some(term => normalized.includes(term)))?.[0]
}

function inferCategory(query: string): ProductCategory | undefined {
  const queryTokens = tokens(query)
  return (Object.entries(CATEGORY_TERMS) as [ProductCategory, string[]][])
    .find(([, terms]) => terms.some(term => queryTokens.includes(term)))?.[0]
}

export function normalizeSearchInput(input: ProductSearchInput): ProductSearchInput {
  const query = input.query.trim()
  return {
    query,
    category: input.category ?? inferCategory(query),
    occasion: input.occasion ?? inferOccasion(query),
    maxPrice: input.maxPrice ?? inferMaxPrice(query),
    retailerIds: input.retailerIds,
  }
}

export function scoreProduct(product: Product, input: ProductSearchInput, userStyles: StyleId[]): number {
  const normalized = normalizeSearchInput(input)
  const queryTokens = tokens(normalized.query)
  const nameTokens = tokens(product.name)
  const descriptionTokens = tokens(product.description)
  const searchableTags = [...product.styleTags, ...product.occasionTags, product.category, product.brand, product.retailer]
    .flatMap(tokens)

  let score = 0
  if (normalized.category === product.category) score += 4
  if (normalized.occasion && product.occasionTags.includes(normalized.occasion)) score += 4
  score += product.styleTags.filter(style => userStyles.includes(style)).length * 3

  for (const token of queryTokens) {
    if (nameTokens.some(nameToken => nameToken === token || nameToken.startsWith(token))) score += 3
    if (searchableTags.some(tag => tag === token || tag.startsWith(token))) score += 2
    if (descriptionTokens.some(descriptionToken => descriptionToken === token || descriptionToken.startsWith(token))) score += 1
  }

  return score
}

export function rankProducts(
  catalog: readonly Product[],
  input: ProductSearchInput,
  userStyles: StyleId[],
  gender: ShoppingGender = 'all',
  limit = 12,
): Product[] {
  const normalized = normalizeSearchInput(input)
  return catalog
    .filter(product => normalized.maxPrice === undefined || product.price <= normalized.maxPrice)
    .filter(product => normalized.category === undefined || product.category === normalized.category)
    .filter(product => gender === 'all' || product.gender === 'all' || product.gender === gender)
    .filter(product => !normalized.retailerIds?.length || normalized.retailerIds.includes(product.retailerId))
    .map(product => ({ product, score: scoreProduct(product, normalized, userStyles) }))
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map(({ product }) => product)
}
