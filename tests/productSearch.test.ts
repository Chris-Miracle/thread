import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { inferMaxPrice, rankProducts, scoreProduct } from '../app/domain/productSearch'

describe('deterministic verified-product search', () => {
  it('ranks dinner dresses for the women department', () => {
    const results = rankProducts(PRODUCTS, { query: 'relaxed dinner dress' }, ['smart-casual'], 'women')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.category).toBe('dresses')
    expect(results[0]?.url).toMatch(/^https:\/\//)
  })

  it('extracts a maximum price from natural language', () => {
    expect(inferMaxPrice("I'm going to dinner. Something relaxed under $180.")).toBe(180)
  })

  it('filters every result above maxPrice', () => {
    const results = rankProducts(PRODUCTS, { query: 'dinner look', maxPrice: 25 }, ['minimal'], 'all')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(product => product.price <= 25)).toBe(true)
  })

  it('restricts results to a category and selected retailers', () => {
    const results = rankProducts(PRODUCTS, { query: 'clean top', category: 'tops', retailerIds: ['uniqlo'] }, ['minimal'], 'all')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(product => product.category === 'tops' && product.retailerId === 'uniqlo')).toBe(true)
  })

  it('honours the saved shopping department', () => {
    const results = rankProducts(PRODUCTS, { query: 'shirt' }, ['streetwear'], 'men')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(product => product.gender === 'men' || product.gender === 'all')).toBe(true)
  })

  it('weights style preferences without requiring style in the query', () => {
    const minimal = PRODUCTS.find(product => product.name === 'Cotton Shirt')!
    const streetwear = PRODUCTS.find(product => product.name === 'Cash Only Striped Button Up Shirt')!
    expect(scoreProduct(minimal, { query: 'new look' }, ['minimal'])).toBeGreaterThan(scoreProduct(streetwear, { query: 'new look' }, ['minimal']))
    expect(scoreProduct(streetwear, { query: 'new look' }, ['streetwear'])).toBeGreaterThan(scoreProduct(minimal, { query: 'new look' }, ['streetwear']))
  })
})
