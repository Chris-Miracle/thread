import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { matchesSavedSize } from '../app/domain/research/shopRequests'
import type { ProductCandidateInput, StyleProfile } from '../app/types/thread'
import { DEFAULT_PROFILE, candidateFromFixture, claimRetailerTargets, makeActions } from './helpers'

const men: StyleProfile = { ...DEFAULT_PROFILE, shoppingDepartment: 'men', clothingSizes: { tops: 'L', bottoms: 'XL' } }
const shoeSizes = ['7', '8', '9', '10', '11', '12']
const featured = [{ name: 'Numeric shoe size', label: '9' }, { name: 'Color', label: 'Black' }]

/** What an agent publishes after copying one ALDO search_catalog result, including product.options. */
function aldoLoafer(): ProductCandidateInput {
  return {
    url: 'https://www.aldoshoes.com/ca/en/products/paterson-black?variant=111',
    name: 'Paterson',
    image: 'https://cdn.shopify.com/s/files/paterson.jpg',
    category: 'footwear',
    shoppingDepartment: 'men',
    shop: {
      productId: 'gid://shopify/p/paterson',
      variantId: 'gid://shopify/ProductVariant/111',
      sellerDomain: 'aldo-ca.myshopify.com',
      sellerName: 'ALDO',
      sellerUrl: 'https://www.aldoshoes.com',
      price: { amount: 12497, currency: 'CAD' },
      available: true,
      selectedOptions: featured,
      options: [
        { name: 'Color', values: [{ label: 'Black' }, { label: 'Cognac' }] },
        { name: 'Numeric shoe size', values: shoeSizes.map(label => ({ label })) },
      ],
    },
  }
}

function shoeMission(profile: StyleProfile) {
  const harness = makeActions({ profile })
  const started = harness.actions.startShoppingSearch({
    rawPrompt: 'ALDO loafers for a dinner',
    shoppingDepartment: 'men',
    needs: [{ intent: 'shoes', queries: ['loafers'], categories: ['footwear'] }],
  })
  const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
  const published = harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [aldoLoafer()] })
  expect(published.rejected).toEqual([])
  return { harness, searchId: started.searchId, target, product: published.accepted[0]! }
}

describe('sizes and options from Shop and retailers', () => {
  it('matches saved sizes against merchant labels without guessing', () => {
    expect(matchesSavedSize('Large (L)', 'L')).toBe(true)
    expect(matchesSavedSize('Large', 'L')).toBe(true)
    expect(matchesSavedSize('Extra large (XL)', 'L')).toBe(false)
    expect(matchesSavedSize('10', '10')).toBe(true)
    expect(matchesSavedSize('10.5', '10')).toBe(false)
  })

  it('records every size and colour Shop offers when a result is published', () => {
    const { product } = shoeMission(men)
    expect(product.sizes).toEqual(shoeSizes)
    expect(product.colors).toEqual(['Black', 'Cognac'])
  })

  it('records the sizes and colours a retailer listing shows', () => {
    const harness = makeActions({ profile: men })
    const started = harness.actions.startShoppingSearch({ rawPrompt: 'Find a button up shirt', shoppingDepartment: 'men', constraints: { retailerIds: ['fashion-nova'] } })
    const target = claimRetailerTargets(harness.actions, { searchId: started.searchId, limit: 1 }).targets[0]!
    const fixture = PRODUCTS.find(product => product.name === 'Cash Only Striped Button Up Shirt')!
    const published = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [{ ...candidateFromFixture(fixture), sizes: fixture.sizes, colors: fixture.colors }],
    })
    expect(published.accepted[0]).toMatchObject({ sizes: fixture.sizes, colors: fixture.colors })
  })

  it('asks for a shoe size instead of carrying Shop’s featured size when none is saved', () => {
    const { harness, searchId, product } = shoeMission(men)
    const basket = harness.actions.cartProposedBasket({ searchId })
    expect(basket.added).toEqual([])
    expect(basket.needsAction[0]).toMatchObject({ productId: product.id, reason: expect.stringContaining('No saved shoe size') })
    expect(basket.needsAction[0]!.steps.map(step => step.tool)).toEqual(['choose_size', 'update_profile'])
    expect(basket.needsAction[0]!.steps[0]!.arguments).toMatchObject({ options: shoeSizes })
    expect(basket.needsAction[0]!.steps[1]!.arguments).toEqual({ shoeSize: '<size the person chose>' })
    expect(JSON.stringify(basket.needsAction)).not.toContain('"label":"9"')
  })

  it('reads every size label without requesting the featured size when Shop reported none', () => {
    const harness = makeActions({ profile: { ...men, shoeSize: '10' } })
    const started = harness.actions.startShoppingSearch({ rawPrompt: 'ALDO loafers', shoppingDepartment: 'men', needs: [{ intent: 'shoes', queries: ['loafers'], categories: ['footwear'] }] })
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const { options: _options, ...shop } = aldoLoafer().shop!
    harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [{ ...aldoLoafer(), shop: { ...shop, selectedOptions: [{ name: 'Numeric shoe size', label: '9' }] } }] })
    const inspect = harness.actions.cartProposedBasket({ searchId: started.searchId }).needsAction[0]!.steps[0]!
    expect(inspect).toMatchObject({ tool: 'inspect_shop_product', arguments: { requestedOptions: [] } })
  })

  it('verifies and adds the saved shoe size, using the merchant’s own option name', () => {
    const { harness, searchId, product } = shoeMission({ ...men, shoeSize: '10' })
    const basket = harness.actions.cartProposedBasket({ searchId })
    const inspect = basket.needsAction[0]!.steps.find(step => step.tool === 'inspect_shop_product')!
    expect(inspect.arguments.requestedOptions).toEqual([{ name: 'Color', label: 'Black' }, { name: 'Numeric shoe size', label: '10' }])
    const chosen = [{ name: 'Numeric shoe size', label: '10' }, { name: 'Color', label: 'Black' }]
    harness.actions.enrichProduct(searchId, {
      productId: product.id,
      shopProductId: 'gid://shopify/p/paterson',
      requestedOptions: chosen,
      variants: [{ id: 'gid://shopify/ProductVariant/112', options: chosen, available: true, price: { amount: 12497, currency: 'CAD' }, checkoutUrl: 'https://www.aldoshoes.com/cart/112:1' }],
    })
    const added = harness.actions.cartProposedBasket({ searchId })
    expect(added.needsAction).toEqual([])
    expect(added.added[0]).toMatchObject({ productId: product.id, size: '10' })
    expect(added.cart.items[0]!.selectedOptions).toEqual(chosen)
  })

  it('adds retailer apparel in the saved clothing size once the page’s sizes are recorded', () => {
    const harness = makeActions({ profile: men })
    const started = harness.actions.startShoppingSearch({ rawPrompt: 'Find a button up shirt', shoppingDepartment: 'men', constraints: { retailerIds: ['fashion-nova'] } })
    const target = claimRetailerTargets(harness.actions, { searchId: started.searchId, limit: 1 }).targets[0]!
    const fixture = PRODUCTS.find(product => product.name === 'Cash Only Striped Button Up Shirt')!
    const product = harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [candidateFromFixture(fixture)] }).accepted[0]!

    let basket = harness.actions.cartProposedBasket({ searchId: started.searchId })
    expect(basket.needsAction[0]!.steps.map(step => step.tool)).toEqual(['open', 'enrich_product'])
    harness.actions.enrichProduct(started.searchId, { productId: product.id, availability: 'in-stock' })
    basket = harness.actions.cartProposedBasket({ searchId: started.searchId })
    expect(basket.needsAction[0]!.reason).toContain('offered sizes were not recorded')

    harness.actions.enrichProduct(started.searchId, { productId: product.id, sizes: fixture.sizes, colors: ['Black'] })
    basket = harness.actions.cartProposedBasket({ searchId: started.searchId })
    expect(basket.needsAction).toEqual([])
    expect(basket.added[0]).toMatchObject({ productId: product.id, size: 'L', color: 'Black' })
  })
})
