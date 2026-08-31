import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { inferMaxPrice, rankProducts, scoreProduct } from '../app/domain/productSearch'

describe('development fixture catalog', () => {
  it('remains deterministic for tests without being exposed as a WebMCP search tool', () => {
    const results = rankProducts(PRODUCTS, { query: 'relaxed dinner dress' }, ['smart-casual'], 'women')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.category).toBe('dresses')
  })

  it('uses priceCad, category, retailer, and department in fixture filtering', () => {
    const results = rankProducts(PRODUCTS, {
      query: 'clean top under $70',
      category: 'tops',
      maxPriceCad: 70,
      retailerIds: ['uniqlo'],
    }, ['minimal'], 'women')
    expect(results.every(product => product.priceCad !== undefined
      && product.priceCad <= 70
      && product.category === 'tops'
      && product.retailerId === 'uniqlo'
      && (product.shoppingDepartment === 'women' || product.shoppingDepartment === 'all'))).toBe(true)
  })

  it('extracts natural-language budgets and weights saved styles', () => {
    expect(inferMaxPrice('something relaxed under $180')).toBe(180)
    const minimal = PRODUCTS.find(product => product.name === 'Cotton Shirt')!
    const streetwear = PRODUCTS.find(product => product.name === 'Cash Only Striped Button Up Shirt')!
    expect(scoreProduct(minimal, { query: 'new look' }, ['minimal'])).toBeGreaterThan(scoreProduct(streetwear, { query: 'new look' }, ['minimal']))
  })
})
