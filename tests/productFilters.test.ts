import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { filterProducts } from '../app/domain/productFilters'
import { emptyResultFilters } from '../app/types/thread'

describe('shared result filters', () => {
  it('combines store, category, and maximum price without mutating the source', () => {
    const source = [...PRODUCTS]
    const retailer = PRODUCTS[0]!.retailer
    const category = PRODUCTS[0]!.category
    const results = filterProducts(source, { ...emptyResultFilters(), retailer, category, maxPrice: PRODUCTS[0]!.price })
    expect(results.every(product => product.retailer === retailer && product.category === category && product.price <= PRODUCTS[0]!.price)).toBe(true)
    expect(source).toEqual(PRODUCTS)
  })

  it('sorts visible products by price while preserving recommended order by default', () => {
    const sample = PRODUCTS.slice(0, 5)
    expect(filterProducts(sample, emptyResultFilters()).map(product => product.id)).toEqual(sample.map(product => product.id))
    const sorted = filterProducts(sample, { ...emptyResultFilters(), sort: 'price-asc' })
    expect(sorted.map(product => product.price)).toEqual([...sorted.map(product => product.price)].sort((a, b) => a - b))
  })
})
