import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { filterProducts } from '../app/domain/productFilters'
import { rankAndDiversifyProducts, scoreCandidate } from '../app/domain/products/productRanking'
import { emptyResultFilters, type Product } from '../app/types/thread'
import { makeActions } from './helpers'

function product(overrides: Partial<Product>): Product {
  return {
    ...PRODUCTS[0]!,
    searchId: 'search:test',
    targetId: 'target:fashion-nova',
    source: 'agent',
    observedAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  }
}

describe('live product ranking and diversity', () => {
  it('scores mission, style, budget, availability, and completeness signals', () => {
    const harness = makeActions()
    harness.actions.startShoppingSearch({
      rawPrompt: 'minimal linen dinner clothes for vacation under $180 CAD',
      constraints: { maxPriceCad: 180, retailerIds: ['fashion-nova'] },
      needs: [{ intent: 'dinner', queries: ['linen dinner dress'], categories: ['dresses'] }],
    })
    const session = harness.search.value.activeSearch!
    const relevant = product({
      name: 'Minimal Linen Dinner Dress',
      category: 'dresses',
      styleTags: ['minimal'],
      occasionTags: ['dinner', 'vacation'],
      priceCad: 120,
      availability: 'in-stock',
      stage: 'enriched',
    })
    const weak = product({
      id: 'product:weak',
      name: 'Graphic Training Tee',
      category: 'activewear',
      styleTags: ['sporty'],
      occasionTags: ['training'],
      priceCad: 175,
      availability: 'unknown',
      stage: 'candidate',
      image: undefined,
    })
    expect(scoreCandidate(relevant, session)).toBeGreaterThan(scoreCandidate(weak, session))
  })

  it('penalizes retailer repetition and near-duplicate products', () => {
    const harness = makeActions()
    harness.actions.startShoppingSearch({
      rawPrompt: 'vacation dresses',
      shoppingDepartment: 'all',
      constraints: { retailerIds: ['fashion-nova', 'shein', 'uniqlo'] },
      needs: [{ intent: 'vacation', queries: ['vacation linen dress'], categories: ['dresses'] }],
    })
    const session = harness.search.value.activeSearch!
    const products = [
      product({ id: 'a1', name: 'Linen Vacation Dress', retailerId: 'fashion-nova', retailer: 'Fashion Nova', targetId: 'target:fashion-nova' }),
      product({ id: 'a2', name: 'Linen Vacation Midi Dress', retailerId: 'fashion-nova', retailer: 'Fashion Nova', targetId: 'target:fashion-nova' }),
      product({ id: 'b1', name: 'Resort Linen Dress', retailerId: 'shein', retailer: 'SHEIN', targetId: 'target:shein' }),
      product({ id: 'c1', name: 'Linen Shirt Dress', retailerId: 'uniqlo', retailer: 'UNIQLO', targetId: 'target:uniqlo' }),
    ]
    const ranked = rankAndDiversifyProducts(products, session)
    expect(new Set(ranked.products.slice(0, 3).map(item => item.retailerId)).size).toBeGreaterThan(1)
    expect(ranked.rankings.find(item => item.productId === 'a2')?.diversityAdjustment).toBeLessThan(0)
  })

  it('makes recommended order the deterministic ranked order while price sorts remain explicit', () => {
    const sample = [
      product({ id: 'recommended-first', relevanceScore: 50, priceCad: 150 }),
      product({ id: 'recommended-second', relevanceScore: 40, priceCad: 20 }),
    ]
    expect(filterProducts(sample, emptyResultFilters()).map(item => item.id)).toEqual(['recommended-first', 'recommended-second'])
    expect(filterProducts(sample, { ...emptyResultFilters(), sort: 'price-asc' }).map(item => item.id)).toEqual(['recommended-second', 'recommended-first'])
  })
})
