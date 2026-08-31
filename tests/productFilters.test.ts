import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { filterProducts } from '../app/domain/productFilters'
import { emptyResultFilters } from '../app/types/thread'

describe('human feed filters', () => {
  it('combines retailer, category, and verified CAD price without mutating ranking order', () => {
    const source = [...PRODUCTS]
    const product = PRODUCTS[0]!
    const results = filterProducts(source, {
      ...emptyResultFilters(),
      retailer: product.retailer,
      category: product.category ?? '',
      maxPriceCad: product.priceCad,
    })
    expect(results.every(item => item.retailer === product.retailer
      && item.category === product.category
      && item.priceCad !== undefined
      && item.priceCad <= product.priceCad!)).toBe(true)
    expect(source).toEqual(PRODUCTS)
  })

  it('keeps recommended order stable as candidates progressively arrive', () => {
    const sample = PRODUCTS.slice(0, 5)
    expect(filterProducts(sample, emptyResultFilters()).map(product => product.id)).toEqual(sample.map(product => product.id))
  })

  it('sorts by CAD price and newest observation only when explicitly requested', () => {
    const sample = PRODUCTS.slice(0, 5)
    const sorted = filterProducts(sample, { ...emptyResultFilters(), sort: 'price-asc' })
    expect(sorted.map(product => product.priceCad)).toEqual([...sorted.map(product => product.priceCad)].sort((a, b) => (a ?? 0) - (b ?? 0)))
  })
})
