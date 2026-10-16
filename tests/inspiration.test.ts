import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { productIdFromUrl } from '../app/domain/productIdentity'
import { MAX_INSPIRATION_ITEMS } from '../app/domain/threadActions'
import type { Product } from '../app/types/thread'
import { SEARCH_STORAGE_KEY } from '../app/utils/storage'
import { candidateFromFixture, makeActions, makeStorage, resolveShopCatalogAsUnavailable } from './helpers'

const PIN = { imageUrl: 'https://i.pinimg.com/736x/aa/linen-look.jpg', sourceUrl: 'https://www.pinterest.com/pin/42/', note: 'white linen resort look' }
const UPLOAD = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='

const shopUrl = 'https://www.fashionnova.com/products/on-your-mind-linen-shirt-fncolorname-white'
const shopShirt: Product = {
  ...PRODUCTS.find(product => product.retailerId === 'fashion-nova')!,
  id: productIdFromUrl(shopUrl),
  name: 'On Your Mind Linen Shirt',
  url: shopUrl,
  category: 'tops',
  commerce: {
    provider: 'shop',
    productId: 'gid://shopify/p/1AhFnKDWDBAAHV5NjpltCm',
    sellerDomain: 'fnova.myshopify.com',
    url: `${shopUrl}?variant=1`,
    selectedOptions: [],
  },
}
const browsedShirt = PRODUCTS.find(product => product.retailerId === 'uniqlo')!

function vacation(harness: ReturnType<typeof makeActions>) {
  return harness.actions.startShoppingSearch({
    rawPrompt: 'Linen for a resort weekend',
    needs: [{ intent: 'linen', queries: ['linen shirt'], categories: ['tops'] }],
  })
}

describe('inspiration board', () => {
  it('lets the Pinterest target complete with pins instead of products', () => {
    const harness = makeActions()
    const { searchId } = vacation(harness)
    const status = harness.actions.getSearchStatus(searchId)
    const pinterest = status.targets.find(target => target.id === 'discovery:pinterest')!
    expect(pinterest.note).toContain('add_inspiration')
    // Resolve everything ranked ahead of Pinterest so it can be claimed.
    resolveShopCatalogAsUnavailable(harness.actions, searchId)
    let claimed = harness.actions.claimSearchTargets({ searchId, limit: 1 }).targets[0]!
    while (claimed.id !== 'discovery:pinterest') {
      harness.actions.completeSearchTarget({ searchId, targetId: claimed.id, status: 'no-results', note: 'Not needed for this test.' })
      claimed = harness.actions.claimSearchTargets({ searchId, limit: 1 }).targets[0]!
    }
    expect(() => harness.actions.completeSearchTarget({ searchId, targetId: claimed.id, status: 'complete' })).toThrow('zero accepted products')
    harness.actions.addInspiration({ source: 'pinterest', ...PIN, searchId, targetId: claimed.id }, 'agent')
    expect(harness.actions.completeSearchTarget({ searchId, targetId: claimed.id, status: 'complete' }).target.status).toBe('complete')
  })

  it('validates pins and uploads and never silently drops items', () => {
    const { actions } = makeActions()
    expect(() => actions.addInspiration({ source: 'pinterest', ...PIN, sourceUrl: 'https://example.com/pin/1' })).toThrow('Pinterest pin URL')
    expect(() => actions.addInspiration({ source: 'pinterest', ...PIN, imageUrl: 'http://i.pinimg.com/a.jpg' })).toThrow('HTTPS')
    expect(() => actions.addInspiration({ source: 'upload', imageData: 'not-an-image' })).toThrow('base64 data URL')
    actions.addInspiration({ source: 'pinterest', ...PIN })
    expect(() => actions.addInspiration({ source: 'pinterest', ...PIN })).toThrow('already on your inspiration board')
    for (let index = 1; index < MAX_INSPIRATION_ITEMS; index += 1) actions.addInspiration({ source: 'upload', imageData: `${UPLOAD}${index}` })
    expect(() => actions.addInspiration({ source: 'upload', imageData: UPLOAD })).toThrow(`holds ${MAX_INSPIRATION_ITEMS} images`)
    expect(actions.getInspiration()).toHaveLength(MAX_INSPIRATION_ITEMS)
  })

  it('persists the board across reloads and clears it on reset', () => {
    const storage = makeStorage()
    makeActions({ storage }).actions.addInspiration({ source: 'upload', imageData: UPLOAD })
    const second = makeActions({ storage, hydrated: false })
    second.actions.hydrate()
    expect(second.actions.getInspiration()[0]).toMatchObject({ source: 'upload', imageData: UPLOAD })
    second.actions.resetWorkspace()
    expect(second.actions.getInspiration()).toEqual([])
  })
})

describe('find_similar', () => {
  it('adds a Shop like-by-id target to the active mission, once per seed', () => {
    const harness = makeActions({ fixtures: [shopShirt] })
    const { searchId } = vacation(harness)
    const result = harness.actions.findSimilar({ productId: shopShirt.id })
    expect(result.mode).toBe('appended')
    if (result.mode !== 'appended') return
    expect(result.target).toMatchObject({ sourceType: 'catalog', name: `More like ${shopShirt.name}` })
    expect(result.target.catalogRequests?.[0]?.arguments.catalog.like).toEqual([{ id: shopShirt.commerce!.productId }])
    expect(() => harness.actions.findSimilar({ productId: shopShirt.id })).toThrow('already looking')
    expect(harness.actions.getSearchStatus(searchId).targets.filter(target => target.seed)).toHaveLength(1)
  })

  it('falls back to a text query for products found by browsing', () => {
    const harness = makeActions()
    vacation(harness)
    const result = harness.actions.findSimilar({ productId: browsedShirt.id })
    if (result.mode !== 'appended') throw new Error('Expected an appended target.')
    expect(result.target.catalogRequests?.[0]?.arguments.catalog).toMatchObject({ query: browsedShirt.name })
    expect(result.target.catalogRequests?.[0]?.arguments.catalog.like).toBeUndefined()
  })

  it('starts a seeded follow-up mission when nothing is active', () => {
    const harness = makeActions({ fixtures: [shopShirt] })
    const result = harness.actions.findSimilar({ productId: shopShirt.id })
    expect(result.mode).toBe('new-mission')
    if (result.mode !== 'new-mission') return
    expect(result.mission).toMatchObject({ rawPrompt: `More like ${shopShirt.name}`, seeds: [{ kind: 'product', shopProductId: shopShirt.commerce!.productId }] })
    expect(result.mission.needs[0]).toMatchObject({ categories: ['tops'] })
    const targets = harness.actions.getSearchStatus(result.searchId).targets
    expect(targets.filter(target => target.seed).map(target => target.rank)).toEqual([2])
  })

  it('hands upload bytes to Shop only at claim time and keeps them out of the saved mission', () => {
    const storage = makeStorage()
    const harness = makeActions({ storage })
    const upload = harness.actions.addInspiration({ source: 'upload', imageData: UPLOAD })
    const started = harness.actions.findSimilar({ inspirationId: upload.id })
    if (started.mode !== 'new-mission') throw new Error('Expected a new mission.')
    expect(storage.getItem(SEARCH_STORAGE_KEY)).not.toContain('/9j/4AAQ')
    const claimed = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 2 }).targets
    const similar = claimed.find(target => target.seed)!
    expect(similar.catalogRequests?.[0]?.arguments.catalog.like).toEqual([{ image: { content_type: 'image/jpeg', data: '/9j/4AAQSkZJRgABAQ==' } }])
  })

  it('never skips a similarity search the person asked for when the basket is satisfied early', () => {
    const harness = makeActions({ fixtures: [shopShirt] })
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'One Uniqlo shirt',
      constraints: { retailerIds: ['uniqlo'] },
      needs: [{ intent: 'shirt', queries: ['shirt'], categories: ['tops'] }],
    })
    resolveShopCatalogAsUnavailable(harness.actions, started.searchId)
    const retailer = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    harness.actions.findSimilar({ productId: shopShirt.id })
    harness.actions.publishCandidates({ searchId: started.searchId, targetId: retailer.id, candidates: [candidateFromFixture(browsedShirt)] })
    const completed = harness.actions.completeSearchTarget({ searchId: started.searchId, targetId: retailer.id, status: 'complete' })
    expect(completed.searchStatus).toBe('active')
    expect(completed.nextAction).toBe('claim_search_targets')
  })

  it('seeds replacement research with liked Shop products', () => {
    const harness = makeActions({ fixtures: [shopShirt] })
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Two linen tops',
      shoppingDepartment: 'all',
      needs: [{ intent: 'linen tops', queries: ['linen top'], categories: ['tops'], quantity: 2 }],
    })
    const catalog = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: catalog.id,
      candidates: [
        { url: shopShirt.commerce!.url, name: shopShirt.name, image: shopShirt.image!, category: 'tops', priceCad: 37, shop: { productId: shopShirt.commerce!.productId, sellerDomain: 'fnova.myshopify.com' } },
        { url: 'https://www.fashionnova.com/products/second-linen-top', name: 'Second linen top', image: shopShirt.image!, category: 'tops', priceCad: 29, shop: { productId: 'gid://shopify/p/second', sellerDomain: 'fnova.myshopify.com' } },
        { url: 'https://www.fashionnova.com/products/gauze-camp-shirt', name: 'Gauze camp shirt', image: shopShirt.image!, category: 'tops', priceCad: 41, shop: { productId: 'gid://shopify/p/third', sellerDomain: 'fnova.myshopify.com' } },
        { url: 'https://www.fashionnova.com/products/ribbed-tank', name: 'Ribbed tank', image: shopShirt.image!, category: 'tops', priceCad: 22, shop: { productId: 'gid://shopify/p/fourth', sellerDomain: 'fnova.myshopify.com' } },
      ],
    })
    harness.actions.completeSearchTarget({ searchId: started.searchId, targetId: catalog.id, status: 'complete' })
    const review = harness.search.value.activeSearch!.recommendationReview!
    const [kept, replaced] = review.productIds
    const result = harness.actions.reviewRecommendations({ searchId: started.searchId, decision: 'replace-selected', rejectedProductIds: [replaced!] })
    const keptProduct = harness.search.value.recentSearches[0]!.products.find(product => product.id === kept)!
    expect(result.replacement!.mission.seeds).toEqual([expect.objectContaining({ kind: 'product', productId: kept, shopProductId: keptProduct.commerce!.productId })])
  })
})
