import { inferMaxPriceCad } from '~/domain/search/mission'
import type { Product, ProductSearchInput, ShoppingDepartment, StyleId } from '~/types/thread'

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'find', 'get', 'in', 'me', 'my', 'of', 'the', 'to'])

function tokens(value: string | undefined): string[] {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ').split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))
}

export function inferMaxPrice(query: string): number | undefined {
  return inferMaxPriceCad(query)
}

export function scoreProduct(product: Product, input: ProductSearchInput, userStyles: StyleId[]): number {
  const queryTokens = tokens(input.query)
  const productTokens = tokens([product.name, product.brand, product.description, product.category, product.retailer].filter(Boolean).join(' '))
  let score = 0
  if (input.category === product.category) score += 5
  if (input.occasion && product.occasionTags.includes(input.occasion)) score += 5
  score += product.styleTags.filter(style => userStyles.includes(style)).length * 3
  score += queryTokens.filter(token => productTokens.some(candidate => candidate === token || candidate.startsWith(token))).length * 2
  return score
}

export function rankProducts(
  catalog: readonly Product[],
  input: ProductSearchInput,
  userStyles: StyleId[],
  department: ShoppingDepartment = 'all',
  limit = 50,
): Product[] {
  const maxPriceCad = input.maxPriceCad ?? inferMaxPriceCad(input.query)
  return catalog
    .filter(product => maxPriceCad === undefined || (product.priceCad !== undefined && product.priceCad <= maxPriceCad))
    .filter(product => input.category === undefined || product.category === input.category)
    .filter(product => department === 'all' || product.shoppingDepartment === 'all' || product.shoppingDepartment === department)
    .filter(product => !input.retailerIds?.length || input.retailerIds.includes(product.retailerId))
    .map(product => ({ product, score: scoreProduct(product, input, userStyles) }))
    .sort((left, right) => right.score - left.score
      || (left.product.priceCad ?? Number.POSITIVE_INFINITY) - (right.product.priceCad ?? Number.POSITIVE_INFINITY)
      || left.product.id.localeCompare(right.product.id))
    .slice(0, limit)
    .map(item => item.product)
}
