import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { createSearchMission } from '../app/domain/search/mission'
import { directCheckoutUrl } from '../app/domain/cart/checkoutPlan'
import { hydrateCartState } from '../app/domain/persistence'
import { storeDomain } from '../app/domain/search/stores'
import type { Product, ProductCandidateInput } from '../app/types/thread'
import { createThreadToolDefinitions } from '../app/webmcp/registerThreadTools'
import { makeActions, DEFAULT_PROFILE } from './helpers'

const dinner = 'Shop for a dinner with a $390 CAD total budget: one shirt, one pair of trousers, one pair of shoes, a belt, a bracelet and two perfumes.'
const mismatch = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/shop/option-substitution.json`, 'utf8'))
const profile = { ...DEFAULT_PROFILE, shoppingDepartment: 'men' as const }
const checkoutUrl = 'https://store.example-shop.com/cart/123:1?_gsid=keep&payment=shop_pay'
function shopProduct(): Product {
  return { ...PRODUCTS[0]!, id: 'shop-product', category: 'footwear', sizes: ['7', '11'], colors: ['Brown'], stage: 'enriched', priceCad: 70,
    commerce: { provider: 'shop', productId: 'gid://shopify/p/123', sellerDomain: 'seller.myshopify.com', sellerName: 'Seller',
      url: 'https://store.example-shop.com/products/shoe?variant=123&_gsid=keep', variantId: 'gid://shopify/ProductVariant/123',
      selectedOptions: [{ name: 'Size', label: '7' }, { name: 'Color', label: 'Brown' }] },
    variants: [{ id: 'gid://shopify/ProductVariant/123', options: [{ name: 'Size', label: '7' }, { name: 'Color', label: 'Brown' }], size: '7', color: 'Brown', available: true, priceMinor: 7000, currency: 'CAD', checkoutUrl }] }
}

describe('Shop reliability regressions', () => {
  it('preserves every dinner item, both perfumes and the total budget from the original failed brief', () => {
    const mission = createSearchMission({ rawPrompt: dinner }, profile)
    expect(mission.needs.map(n => [n.intent, n.quantity])).toEqual([
      ['shirt', 1], ['trousers', 1], ['shoes', 1], ['belt', 1], ['bracelet', 1], ['perfumes', 2],
    ])
    expect(mission.constraints.overallBudgetCad).toBe(390)
    expect(mission.constraints.categories).toContain('fragrance')
    expect(mission.needs.find(n => n.intent === 'shirt')!.queries).toContain('oxford shirt')
    expect(mission.needs.find(n => n.intent === 'shoes')!.queries).not.toContain('chelsea boots')
  })

  it('claims Shop first even when broad retailers support all six dinner needs', () => {
    const { actions } = makeActions({ profile })
    const mission = actions.startShoppingSearch({ rawPrompt: dinner })
    const claim = actions.claimSearchTargets({ searchId: mission.searchId, limit: 4 })
    expect(claim.targets.every(t => t.sourceType === 'catalog')).toBe(true)
  })

  it('resolves unfamiliar named stores before searching and enforces the verified store domain', () => {
    const { actions } = makeActions({ profile })
    const mission = actions.startShoppingSearch({ rawPrompt: 'Find a shirt from TruClothing under $90 CAD' })
    expect(mission.next.some(step => step.tool === 'resolve_store')).toBe(true)
    expect(() => actions.claimSearchTargets({ searchId: mission.searchId })).toThrow('Resolve')
    const resolved = actions.resolveStore({ searchId: mission.searchId, name: 'TruClothing', domain: 'https://truclothing.com' })
    expect(() => structuredClone(resolved)).not.toThrow()
    const claim = actions.claimSearchTargets({ searchId: mission.searchId, limit: 1 })
    expect(claim.targets[0]!.catalogRequests![0]!.arguments.catalog.filters!.shops).toEqual(['truclothing.com'])
    const variant = mismatch.search.variants[0]
    const result = actions.publishCandidates({ searchId: mission.searchId, targetId: claim.targets[0]!.id, candidates: [{
      name: 'Unrelated shirt', url: variant.url, image: mismatch.search.media[0].url, category: 'tops', shoppingDepartment: 'men',
      shop: { productId: mismatch.search.id, sellerDomain: variant.seller.domain, sellerUrl: variant.seller.url, price: variant.price, available: true },
    }] })
    expect(result.rejected[0]!.reason).toContain('store restriction')
    actions.completeSearchTarget({ searchId: mission.searchId, targetId: claim.targets[0]!.id, status: 'no-results', note: 'Shop has no matching offer.' })
    const fallback = actions.claimSearchTargets({ searchId: mission.searchId, limit: 1 }).targets[0]!
    expect(fallback.id).toBe('store:truclothing.com')
    expect(fallback.searchUrls).toEqual(['https://truclothing.com/'])
  })

  it('recognizes a registered retailer as a hard Shop filter and keeps explicit domains exact', () => {
    const { actions } = makeActions({ profile })
    const mission = actions.startShoppingSearch({ rawPrompt: 'Find a shirt from Gymshark under $90 CAD' })
    const claim = actions.claimSearchTargets({ searchId: mission.searchId, limit: 1 })
    expect(claim.targets[0]!.catalogRequests![0]!.arguments.catalog.filters!.shops).toEqual(['ca.gymshark.com'])
    expect(storeDomain('https://www.truclothing.com/products/shirt')).toBe('truclothing.com')
    expect(() => storeDomain('http://truclothing.com')).toThrow()
    expect(() => storeDomain('https://user:secret@truclothing.com')).toThrow()
  })

  it('rejects the real perfume-to-body-wash substitution without mutating product evidence', () => {
    const { actions } = makeActions({ profile })
    const mission = actions.startShoppingSearch({ rawPrompt: 'Find a perfume under $90 CAD' })
    const target = actions.claimSearchTargets({ searchId: mission.searchId, limit: 1 }).targets[0]!
    const v = mismatch.search.variants[0]
    const candidate: ProductCandidateInput = { name: mismatch.search.title, url: v.url, image: mismatch.search.media[0].url, category: 'fragrance', shoppingDepartment: 'men',
      shop: { productId: mismatch.search.id, variantId: v.id, sellerDomain: v.seller.domain, sellerName: v.seller.name, price: v.price, available: v.availability.available, selectedOptions: v.options } }
    const published = actions.publishCandidates({ searchId: mission.searchId, targetId: target.id, candidates: [candidate] })
    const id = published.accepted[0]!.id
    const substituted = mismatch.detail.variants[0]
    expect(() => actions.enrichProduct(mission.searchId, { productId: id, requestedOptions: mismatch.requested,
      variants: [{ id: substituted.id, options: substituted.options, available: substituted.availability.available, price: substituted.price }] })).toThrow('different options')
    expect(actions.getProductById(id)!.priceCad).toBe(8)
    expect(actions.getProductById(id)!.stage).toBe('candidate')
    expect(() => actions.addToCart(id)).toThrow('enrichment')
  })

  it('refuses unverified or sold-out combinations and never prices them from the featured variant', () => {
    const product = shopProduct()
    const { actions } = makeActions({ fixtures: [product] })
    expect(() => actions.addToCart(product.id, { size: '11', color: 'Brown' })).toThrow('not been verified')
    product.variants!.push({ ...product.variants![0]!, id: 'gid://shopify/ProductVariant/456', size: '11', options: [{ name: 'Size', label: '11' }, { name: 'Color', label: 'Brown' }], available: false })
    expect(() => actions.addToCart(product.id, { size: '11', color: 'Brown' })).toThrow('sold out')
    product.variants![1]!.available = true
    product.variants![1]!.priceMinor = undefined
    expect(() => actions.addToCart(product.id, { size: '11', color: 'Brown' })).toThrow('CAD price')
    expect(actions.getCart().itemCount).toBe(0)
  })

  it('retains exact variant options, separate volumes, prices and checkout URLs after persistence', () => {
    const product = shopProduct()
    product.category = 'fragrance'
    product.sizes = []
    product.colors = []
    const first = product.variants![0]!
    first.options = [{ name: 'Volume', label: '50 ml' }]
    first.size = first.color = undefined
    product.commerce!.selectedOptions = first.options
    product.variants!.push({ ...first, id: 'gid://shopify/ProductVariant/456', options: [{ name: 'Volume', label: '100 ml' }], priceMinor: 9000, checkoutUrl: checkoutUrl.replace('123:1', '456:1') })
    const { actions } = makeActions({ fixtures: [product] })
    const a = actions.addToCart(product.id, { variantId: first.id, selectedOptions: first.options })
    const b = actions.addToCart(product.id, { variantId: product.variants![1]!.id, selectedOptions: product.variants![1]!.options })
    expect(a.item.id).not.toBe(b.item.id)
    expect(actions.getCart().totals[0]!.subtotal).toBe(160)
    expect(directCheckoutUrl(a.item)).toBe(checkoutUrl)
    const restored = hydrateCartState({ version: 4, items: actions.getCart().items, merchantCarts: [] })
    expect(restored.items).toHaveLength(2)
    expect(restored.items[1]!.selectedOptions).toEqual([{ name: 'Volume', label: '100 ml' }])
    expect(directCheckoutUrl(restored.items[0]!)).toBe(checkoutUrl)
    expect(actions.getCheckoutPlan().groups[0]!.lines[0]!.selected).toEqual(first.options)
    expect(() => structuredClone(actions.getCart())).not.toThrow()
  })

  it('does not auto-add the only verified shoe size when the saved size differs', () => {
    const harness = makeActions({ profile: { ...profile, shoeSize: '11' } })
    const { actions } = harness
    const started = actions.startShoppingSearch({ rawPrompt: 'Find shoes under $80 CAD' })
    const target = actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const product = shopProduct()
    const variant = product.variants![0]!
    const publication = actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [{
      name: 'Leather loafers', url: product.commerce!.url, image: product.image!, category: 'footwear', shoppingDepartment: 'men',
      shop: { productId: product.commerce!.productId, variantId: variant.id, sellerDomain: product.commerce!.sellerDomain,
        selectedOptions: variant.options, price: { amount: 7000, currency: 'CAD' }, available: true },
    }] })
    const id = publication.accepted[0]!.id
    actions.enrichProduct(started.searchId, { productId: id, sizes: ['7'], requestedOptions: variant.options,
      variants: [{ id: variant.id, options: variant.options, available: true, price: { amount: 7000, currency: 'CAD' } }] })
    const result = actions.cartProposedBasket({ searchId: started.searchId })
    expect(result.added).toEqual([])
    expect(result.needsAction[0]!.reason).toContain('saved size 11')
    expect(actions.getCart().itemCount).toBe(0)
    actions.enrichProduct(started.searchId, { productId: id, priceCad: 75, requestedOptions: variant.options, variants: [{ id: variant.id, options: variant.options, available: true, price: { amount: 7500, currency: 'CAD' } }] })
    expect(actions.getProductById(id)!.priceCad).toBe(75)
    harness.profile.value!.shoeSize = '7'
    expect(actions.cartProposedBasket({ searchId: started.searchId }).added).toHaveLength(1)
  })

  it('does not treat a colour-only shoe result as size-verified stock', () => {
    const product = shopProduct()
    product.variants![0]!.size = undefined
    product.variants![0]!.options = [{ name: 'Color', label: 'Brown' }]
    product.commerce!.selectedOptions = product.variants![0]!.options
    const { actions } = makeActions({ fixtures: [product] })
    expect(() => actions.addToCart(product.id, { variantId: product.variants![0]!.id })).toThrow('verified a size')
  })

  it('does not preserve a contradictory legacy cart variant during migration', () => {
    const product = shopProduct()
    const restored = hydrateCartState({ version: 4, items: [{ product, size: '11', color: 'Brown', variantId: product.variants![0]!.id }], merchantCarts: [] })
    expect(restored.items[0]!.variantId).toBeUndefined()
    expect(directCheckoutUrl(restored.items[0]!)).toBeUndefined()
  })

  it('never silently drops an unrecognized explicit retailer constraint', () => {
    expect(() => createSearchMission({ rawPrompt: 'Find a shirt', constraints: { retailerIds: ['truclothing'] } }, profile)).toThrow('Unknown retailer ID')
  })

  it('refreshes a repeated variant’s verified price and invalidates its old merchant handoff', () => {
    const product = shopProduct()
    const { actions } = makeActions({ fixtures: [product] })
    actions.addToCart(product.id, { size: '7', color: 'Brown' })
    const groupKey = actions.getCheckoutPlan().groups[0]!.key
    actions.attachMerchantCart({ groupKey, continueUrl: checkoutUrl, total: { amount: 7000, currency: 'CAD' } })
    product.variants![0]!.priceMinor = 7500
    const updated = actions.addToCart(product.id, { size: '7', color: 'Brown' })
    expect(updated.duplicate).toBe(true)
    expect(actions.getCart().itemCount).toBe(1)
    expect(actions.getCart().totals[0]!.subtotal).toBe(75)
    expect(actions.getCheckoutPlan().groups[0]!.status).toBe('stale')
  })

  it('returns a Shop checkout preparation request with exact IDs and preserves every merchant message', async () => {
    const product = shopProduct()
    const { actions } = makeActions({ fixtures: [product] })
    actions.addToCart(product.id, { size: '7', color: 'Brown' })
    const tool = createThreadToolDefinitions(actions).find(t => t.name === 'get_checkout_plan')!
    const result = await tool.execute({}) as any
    expect(result.groups[0].checkoutRequest).toMatchObject({ tool: 'create_checkout', arguments: { shop: 'seller.myshopify.com', checkout: { context: { currency: 'CAD', address_country: 'CA' }, line_items: [{ item: { id: 'gid://shopify/ProductVariant/123' }, quantity: 1 }] } } })
    const messages = Array.from({ length: 12 }, (_, i) => `Merchant message ${i}: ${'Disclosure '.repeat(70)}`)
    actions.attachMerchantCart({ groupKey: result.groups[0].key, continueUrl: checkoutUrl, messages })
    expect(actions.getCart().groups[0]!.merchantCart!.messages).toEqual(messages)
  })
})
