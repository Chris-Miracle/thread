import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromMinorUnits } from '../app/domain/products/productValidation'
import type { ProductCandidateInput, ProductCategory } from '../app/types/thread'
import { claimRetailerTargets, makeActions, makeStorage } from './helpers'

interface ShopVariant {
  id: string
  url: string
  price: { amount: number; currency: string }
  availability: { available: boolean }
  options: Array<{ name: string; label: string }>
  seller: { id: string; name: string; url: string; domain: string }
}
interface ShopProduct {
  id: string
  title: string
  media: Array<{ url: string }>
  variants: ShopVariant[]
}

function fixture(name: string): ShopProduct[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/shop', `${name}.json`), 'utf8')).products
}

const gymshark = fixture('search-gymshark')
const linen = fixture('search-linen')

/** What an agent publishes after copying one search_catalog product unchanged. */
function candidateFromShop(product: ShopProduct, category: ProductCategory): ProductCandidateInput {
  const variant = product.variants[0]!
  return {
    url: variant.url,
    name: product.title,
    image: product.media[0]!.url,
    category,
    shoppingDepartment: 'women',
    shop: {
      productId: product.id,
      variantId: variant.id,
      sellerDomain: variant.seller.domain,
      sellerId: variant.seller.id,
      sellerName: variant.seller.name,
      sellerUrl: variant.seller.url,
      price: variant.price,
      available: variant.availability.available,
      selectedOptions: variant.options,
    },
  }
}

function startCatalogSearch(harness: ReturnType<typeof makeActions>, category: ProductCategory, maxPriceCad?: number) {
  const started = harness.actions.startShoppingSearch({
    rawPrompt: `Find ${category}`,
    shoppingDepartment: 'women',
    needs: [{ intent: category, queries: [category], categories: [category], budgetCad: maxPriceCad }],
    constraints: maxPriceCad ? { maxPriceCad } : undefined,
  })
  const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
  expect(target.sourceType).toBe('catalog')
  return { searchId: started.searchId, target }
}

describe('Shop catalogue publication', () => {
  it('converts minor units with each currency’s own decimal places', () => {
    expect(fromMinorUnits(5000, 'CAD')).toBe(50)
    expect(fromMinorUnits(1500, 'JPY')).toBe(1500)
    expect(() => fromMinorUnits(12.5, 'CAD')).toThrow('positive integer')
  })

  it('publishes a Shop result with registry identity, CAD price, stock, and the exact returned URL', () => {
    const harness = makeActions()
    const { searchId, target } = startCatalogSearch(harness, 'bottoms')
    const result = harness.actions.publishCandidates({ searchId, targetId: target.id, candidates: [candidateFromShop(gymshark[0]!, 'bottoms')] })
    expect(result.rejected).toEqual([])
    const product = result.accepted[0]!
    const variant = gymshark[0]!.variants[0]!
    expect(product).toMatchObject({ retailerId: 'gymshark', retailer: 'Gymshark', priceCad: 50, nativeCurrency: 'CAD', availability: 'in-stock' })
    expect(product.url).toBe('https://ca.checkout.gymshark.com/products/gymshark-everyday-seamless-leggings-black-aw23')
    expect(product.commerce).toMatchObject({
      provider: 'shop',
      productId: gymshark[0]!.id,
      variantId: variant.id,
      sellerDomain: 'gymshark-can.myshopify.com',
      url: variant.url,
      selectedOptions: [{ name: 'Size', label: 'Large' }],
    })
    expect(product.commerce!.url).toContain('_gsid=')
  })

  it('accepts unknown Shopify sellers under their Shop seller name', () => {
    const harness = makeActions()
    const { searchId, target } = startCatalogSearch(harness, 'tops')
    const result = harness.actions.publishCandidates({ searchId, targetId: target.id, candidates: [candidateFromShop(linen[0]!, 'tops')] })
    expect(result.rejected).toEqual([])
    expect(result.accepted[0]).toMatchObject({ retailer: 'MUJI USA', availability: 'out-of-stock' })
    expect(result.accepted[0]!.retailerId).toMatch(/^retailer:/)
  })

  it('merges a Shop result and a browsed copy of the same product page', () => {
    const harness = makeActions()
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Linen shirt from Fashion Nova',
      shoppingDepartment: 'women',
      constraints: { retailerIds: ['fashion-nova'] },
      needs: [{ intent: 'linen shirt', queries: ['linen shirt'], categories: ['tops'] }],
    })
    const [catalog, retailer] = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 2 }).targets
    expect(catalog!.sourceType).toBe('catalog')
    expect(retailer!.retailerId).toBe('fashion-nova')
    const fashionNova = linen.find(product => product.variants[0]!.seller.name === 'Fashion Nova')!
    harness.actions.publishCandidates({ searchId: started.searchId, targetId: catalog!.id, candidates: [candidateFromShop(fashionNova, 'tops')] })
    const browsed = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: retailer!.id,
      candidates: [{
        url: 'https://www.fashionnova.com/products/on-your-mind-linen-shirt-fncolorname-white',
        name: 'On Your Mind Linen Shirt - White',
        image: fashionNova.media[0]!.url,
        category: 'tops',
        shoppingDepartment: 'women',
      }],
    })
    expect(browsed.rejected).toEqual([])
    const products = harness.search.value.activeSearch!.products
    expect(products).toHaveLength(1)
    expect(products[0]!.commerce?.productId).toBe(fashionNova.id)
    expect(products[0]!.needIds).toHaveLength(1)
  })

  it('keeps hard budget and currency rules for Shop results', () => {
    const harness = makeActions()
    const { searchId, target } = startCatalogSearch(harness, 'tops', 30)
    const overBudget = candidateFromShop(linen[0]!, 'tops')
    const usd = { ...candidateFromShop(linen[1]!, 'tops'), shop: { ...candidateFromShop(linen[1]!, 'tops').shop!, price: { amount: 2000, currency: 'USD' } } }
    const result = harness.actions.publishCandidates({ searchId, targetId: target.id, candidates: [overBudget, usd] })
    expect(result.accepted).toEqual([])
    expect(result.rejected.map(item => item.reason)).toEqual([
      expect.stringContaining('exceeds the mission budget'),
      expect.stringContaining('Shop returned this offer in USD 20.00, not CAD'),
    ])
    expect(result.rejected[1]).toMatchObject({ index: 1, name: linen[1]!.title, reason: expect.stringContaining('priceCad') })
  })

  it('accepts a non-CAD Shop offer once the agent supplies a seller-shown CAD price', () => {
    const harness = makeActions()
    const { searchId, target } = startCatalogSearch(harness, 'tops', 30)
    const base = candidateFromShop(linen[1]!, 'tops')
    const usd = { ...base, priceCad: 27.5, shop: { ...base.shop!, price: { amount: 2000, currency: 'USD' } } }
    const result = harness.actions.publishCandidates({ searchId, targetId: target.id, candidates: [usd] })
    expect(result.rejected).toEqual([])
    expect(result.accepted[0]).toMatchObject({ nativePrice: 20, nativeCurrency: 'USD', priceCad: 27.5 })
  })

  it('requires Shop provenance on catalogue targets and rejects it everywhere else', () => {
    const harness = makeActions()
    const { searchId, target } = startCatalogSearch(harness, 'bottoms')
    const { shop: _shop, ...bare } = candidateFromShop(gymshark[0]!, 'bottoms')
    const withoutShop = harness.actions.publishCandidates({ searchId, targetId: target.id, candidates: [bare] })
    expect(withoutShop.rejected[0]?.reason).toContain('must include shop provenance')
    harness.actions.completeSearchTarget({ searchId, targetId: target.id, status: 'no-results', note: 'Shop unavailable' })

    const retailer = claimRetailerTargets(harness.actions, { searchId, limit: 1 }).targets[0]!
    expect(retailer.sourceType).not.toBe('catalog')
    const misplaced = harness.actions.publishCandidates({ searchId, targetId: retailer.id, candidates: [candidateFromShop(gymshark[0]!, 'bottoms')] })
    expect(misplaced.rejected[0]?.reason).toContain('only on Shop catalogue targets')
  })

  it('restores catalogue targets and Shop provenance after reload', () => {
    const storage = makeStorage()
    const first = makeActions({ storage })
    const { searchId, target } = startCatalogSearch(first, 'bottoms')
    first.actions.publishCandidates({ searchId, targetId: target.id, candidates: [candidateFromShop(gymshark[0]!, 'bottoms')] })

    const second = makeActions({ storage, hydrated: false })
    second.actions.hydrate()
    const session = second.search.value.activeSearch!
    expect(session.targets.find(item => item.id === target.id)).toMatchObject({ sourceType: 'catalog', catalogRequests: target.catalogRequests })
    expect(session.products[0]!.commerce).toEqual(first.search.value.activeSearch!.products[0]!.commerce)
  })
})
