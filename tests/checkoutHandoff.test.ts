import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { hydrateCartState } from '../app/domain/persistence'
import { productIdFromUrl } from '../app/domain/productIdentity'
import { CART_STORAGE_KEY } from '../app/utils/storage'
import type { Product } from '../app/types/thread'
import { makeActions, makeStorage } from './helpers'

const browsed = PRODUCTS.find(product => product.retailerId === 'uniqlo')!

function shopProduct(id: string, name: string): Product {
  const url = `https://ca.checkout.gymshark.com/products/${id}`
  return {
    ...browsed,
    id: productIdFromUrl(url),
    name,
    retailer: 'Gymshark',
    retailerId: 'gymshark',
    url,
    colors: [],
    sizes: ['Small', 'Medium'],
    stage: 'enriched',
    availability: 'in-stock',
    priceCad: 50,
    commerce: {
      provider: 'shop',
      productId: `gid://shopify/p/${id}`,
      variantId: `gid://shopify/ProductVariant/${id}-medium`,
      sellerDomain: 'gymshark-can.myshopify.com',
      sellerName: 'Gymshark CA',
      url: `https://ca.checkout.gymshark.com/products/${id}?variant=1&_gsid=abc&utm_source=shopify`,
      selectedOptions: [{ name: 'Size', label: 'Medium' }],
    },
    variants: [
      { id: `gid://shopify/ProductVariant/${id}-small`, options: [{ name: 'Size', label: 'Small' }], size: 'Small', available: false, priceMinor: 5000, currency: 'CAD' },
      { id: `gid://shopify/ProductVariant/${id}-medium`, options: [{ name: 'Size', label: 'Medium' }], size: 'Medium', available: true, priceMinor: 5000, currency: 'CAD' },
    ],
  }
}

const leggings = shopProduct('leggings', 'Everyday Seamless Leggings')
const shorts = shopProduct('shorts', 'Training Shorts')
const CONTINUE_URL = 'https://ca.checkout.gymshark.com/cart/c/abc?key=xyz'

function harness() {
  return makeActions({ fixtures: [leggings, shorts, browsed] })
}

describe('per-merchant cart handoff', () => {
  it('stores the exact Shop variant for the chosen size and refuses sold-out combinations', () => {
    const { actions } = harness()
    expect(() => actions.addToCart(leggings.id, { size: 'Small' })).toThrow('Small is sold out')
    const added = actions.addToCart(leggings.id, { size: 'Medium' })
    expect(added.item.variantId).toBe('gid://shopify/ProductVariant/leggings-medium')
  })

  it('groups Shop sellers separately from retailer links', () => {
    const { actions } = harness()
    actions.addToCart(leggings.id, { size: 'Medium' })
    actions.addToCart(browsed.id, { size: browsed.sizes[0], color: browsed.colors[0] })
    const plan = actions.getCheckoutPlan()
    expect(plan.groups.map(group => [group.key, group.provider, group.status])).toEqual([
      ['shop:gymshark-can.myshopify.com', 'shop', 'needs-cart'],
      [`retailer:${browsed.retailerId}`, 'retailer', 'buy-at-retailer'],
    ])
    expect(plan.shopGroupsNeedingCarts).toEqual(['shop:gymshark-can.myshopify.com'])
    expect(plan.groups[0]!.lines[0]).toMatchObject({ retailerUrl: leggings.commerce!.url, selected: [{ name: 'Size', label: 'Medium' }] })
  })

  it('keeps the continue_url unchanged and marks the handoff stale when the seller group changes', () => {
    const { actions } = harness()
    const first = actions.addToCart(leggings.id, { size: 'Medium' })
    const groupKey = actions.getCheckoutPlan().groups[0]!.key
    const attached = actions.attachMerchantCart({ groupKey, continueUrl: CONTINUE_URL, total: { amount: 5000, currency: 'cad' }, messages: ['Final sale.'] })
    expect(attached.merchantCart).toMatchObject({ continueUrl: CONTINUE_URL, totalMinor: 5000, currency: 'CAD', messages: ['Final sale.'] })
    expect(actions.getCart().groups[0]!.status).toBe('ready')

    actions.addToCart(shorts.id, { size: 'Medium' })
    expect(actions.getCart().groups[0]!.status).toBe('stale')
    actions.removeFromCart(actions.getCart().items.find(item => item.productId === shorts.id)!.id)
    expect(actions.getCart().groups[0]!.status).toBe('ready')

    actions.removeFromCart(first.item.id)
    expect(actions.getCart().groups).toEqual([])
    expect(actions.getCheckoutPlan().groups).toEqual([])
  })

  it('rejects handoffs for unknown groups, retailer groups, and non-HTTPS links', () => {
    const { actions } = harness()
    actions.addToCart(leggings.id, { size: 'Medium' })
    actions.addToCart(browsed.id, { size: browsed.sizes[0], color: browsed.colors[0] })
    expect(() => actions.attachMerchantCart({ groupKey: 'shop:missing', continueUrl: CONTINUE_URL })).toThrow('No cart group')
    expect(() => actions.attachMerchantCart({ groupKey: `retailer:${browsed.retailerId}`, continueUrl: CONTINUE_URL })).toThrow('Only Shop-backed')
    expect(() => actions.attachMerchantCart({ groupKey: 'shop:gymshark-can.myshopify.com', continueUrl: 'http://example.test/cart' })).toThrow('HTTPS')
  })

  it('persists handoffs and migrates version 3 carts without them', () => {
    const storage = makeStorage()
    const first = makeActions({ storage, fixtures: [leggings] })
    first.actions.addToCart(leggings.id, { size: 'Medium' })
    first.actions.attachMerchantCart({ groupKey: 'shop:gymshark-can.myshopify.com', continueUrl: CONTINUE_URL })

    const second = makeActions({ storage, hydrated: false, fixtures: [leggings] })
    second.actions.hydrate()
    expect(second.actions.getCart().groups[0]).toMatchObject({ status: 'ready', merchantCart: { continueUrl: CONTINUE_URL } })
    expect(second.actions.getCart().items[0]!.variantId).toBe('gid://shopify/ProductVariant/leggings-medium')

    const legacy = JSON.parse(storage.getItem(CART_STORAGE_KEY)!)
    const migrated = hydrateCartState({ version: 3, items: legacy.items, merchantCarts: legacy.merchantCarts })
    expect(migrated).toMatchObject({ version: 4, merchantCarts: [] })
    expect(migrated.items).toHaveLength(1)
  })
})
