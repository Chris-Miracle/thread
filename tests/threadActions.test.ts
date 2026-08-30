import { ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { productIdFromUrl } from '../app/domain/productIdentity'
import { createThreadActions, validateAgentStyleProfile, validateStyleProfile } from '../app/domain/threadActions'
import { LocalProductProvider } from '../app/providers/LocalProductProvider'
import { emptySearchLane, type AgentProductInput, type AgentProductState, type CartState, type SearchState, type StyleProfile } from '../app/types/thread'
import type { StorageAdapter } from '../app/utils/storage'

function makeStorage(): StorageAdapter {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

function makeActions(initialProfile: StyleProfile | null = { version: 2, name: 'Chris', gender: 'women', styles: ['minimal'] }) {
  const profile = ref<StyleProfile | null>(initialProfile)
  const cart = ref<CartState>({ version: 2, items: [] })
  const search = ref<SearchState>({ results: emptySearchLane() })
  const agentProducts = ref<AgentProductState>({ version: 1, products: [] })
  const hydrated = ref(true)
  const storage = makeStorage()
  const actions = createThreadActions({ profile, cart, search, agentProducts, hydrated, storage, provider: new LocalProductProvider(PRODUCTS) })
  return { actions, profile, cart, search, agentProducts, storage }
}

function asAgentInput(product = PRODUCTS[0]!): AgentProductInput {
  return {
    name: product.name,
    brand: product.brand,
    retailer: product.retailer,
    category: product.category,
    gender: product.gender,
    price: product.price,
    currency: product.currency,
    image: product.image,
    url: `${product.url}${product.url.includes('?') ? '&' : '?'}utm_source=test-suite`,
    colors: [...product.colors],
    sizes: [...product.sizes],
    styleTags: [...product.styleTags],
    occasionTags: [...product.occasionTags],
    description: product.description,
    availability: product.availability,
    observedAt: product.observedAt,
  }
}

describe('profile validation', () => {
  it('requires a name, shopping department, and supported style', () => {
    expect(() => validateStyleProfile({ name: '', gender: 'women', styles: ['minimal'] })).toThrow('first name')
    expect(() => validateStyleProfile({ name: 'Chris', gender: '', styles: ['minimal'] })).toThrow('shopping for')
    expect(() => validateStyleProfile({ name: 'Chris', gender: 'women', styles: [] })).toThrow('at least one')
    expect(validateStyleProfile({ name: ' Chris ', gender: 'all', styles: ['minimal'] })).toEqual({ version: 2, name: 'Chris', gender: 'all', styles: ['minimal'] })
  })

  it('allows no more than three styles', () => {
    expect(() => validateStyleProfile({ name: 'Chris', gender: 'men', styles: ['minimal', 'streetwear', 'smart-casual', 'classic'] })).toThrow('up to three')
  })

  it('allows an agent-created profile without inventing a style', () => {
    expect(validateAgentStyleProfile({ name: 'Alex', gender: 'all' })).toEqual({ version: 2, name: 'Alex', gender: 'all', styles: [] })
  })
})

describe('agent-assisted profile setup', () => {
  it('creates a browser-local profile without showing products before a search', async () => {
    const harness = makeActions(null)
    const result = await harness.actions.setupProfile({ name: 'Alex', gender: 'women', styles: ['minimal', 'classic'] })

    expect(result.status).toBe('created')
    expect(harness.profile.value).toEqual({ version: 2, name: 'Alex', gender: 'women', styles: ['minimal', 'classic'] })
    expect(harness.search.value.results.hasSearched).toBe(false)
    expect(harness.search.value.results.results).toEqual([])
    expect(harness.storage.getItem('thread.profile.v1')).toContain('Alex')
  })

  it('preserves an existing profile unless replacement is explicit', async () => {
    const harness = makeActions()
    const result = await harness.actions.setupProfile({ name: 'Someone Else', gender: 'men', styles: ['sporty'] })

    expect(result.status).toBe('existing')
    expect(harness.profile.value?.name).toBe('Chris')
    expect(harness.profile.value?.styles).toEqual(['minimal'])
  })

  it('can explicitly replace a profile while preserving styles when omitted', async () => {
    const harness = makeActions()
    const result = await harness.actions.setupProfile({ name: 'Christopher', gender: 'all', replaceExisting: true })

    expect(result.status).toBe('updated')
    expect(harness.profile.value).toEqual({ version: 2, name: 'Christopher', gender: 'all', styles: ['minimal'] })
  })
})

describe('collision-safe product and cart actions', () => {
  let harness: ReturnType<typeof makeActions>
  const cottonShirt = PRODUCTS.find(product => product.name === 'Cotton Shirt')!

  beforeEach(() => { harness = makeActions() })

  it('derives the same product ID after tracking parameters are removed', () => {
    expect(productIdFromUrl(`${cottonShirt.url}?utm_source=agent`)).toBe(productIdFromUrl(`${cottonShirt.url}?utm_source=human`))
  })

  it('adds a verified product and prevents an exact variant duplicate', () => {
    const first = harness.actions.addToCart(cottonShirt.id, { size: 'M', color: 'Off White' })
    const duplicate = harness.actions.addToCart(cottonShirt.id, { size: 'M', color: 'Off White' })
    expect(first.success).toBe(true)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.cartCount).toBe(1)
  })

  it('allows the same product with a different variant and distinct item ID', () => {
    const medium = harness.actions.addToCart(cottonShirt.id, { size: 'M', color: 'Off White' })
    const large = harness.actions.addToCart(cottonShirt.id, { size: 'L', color: 'Off White' })
    expect(medium.item.id).not.toBe(large.item.id)
    expect(harness.actions.getCart().itemCount).toBe(2)
  })

  it('removes one exact cart item and calculates totals by currency', () => {
    const first = harness.actions.addToCart(cottonShirt.id)
    harness.actions.addToCart(PRODUCTS.find(product => product.name === 'Devon Boat Neck Maxi Dress')!.id)
    expect(harness.actions.getCart().totals).toEqual([{ currency: 'CAD', subtotal: 99.9 }])
    expect(harness.actions.removeFromCart(first.item.id)).toBe(true)
    expect(harness.actions.getCart().itemCount).toBe(1)
  })

  it('rejects unknown products and invalid variants', () => {
    expect(() => harness.actions.addToCart('product:unknown:nope')).toThrow('Product not found')
    expect(() => harness.actions.addToCart(cottonShirt.id, { size: '99' })).toThrow('not an available size')
  })
})

describe('unified progressive results', () => {
  it('publishes verified agent products into the shared list', () => {
    const harness = makeActions()
    const started = harness.actions.beginAgentSearch({ query: 'dinner dress under $180', occasion: 'dinner', maxPrice: 180 })
    const published = harness.actions.publishAgentProducts({ searchId: started.searchId, query: started.query, products: [asAgentInput()], complete: true })

    expect(published.accepted).toHaveLength(1)
    expect(harness.search.value.results.results).toHaveLength(1)
    expect(harness.search.value.results.results[0]?.source).toBe('agent')
  })

  it('clears the previous list when a new search begins', async () => {
    const harness = makeActions()
    await harness.actions.searchProducts({ query: 'minimal work top', category: 'tops' }, 'agent')
    expect(harness.search.value.results.results.length).toBeGreaterThan(0)
    harness.actions.beginAgentSearch({ query: 'a different dinner look' })
    expect(harness.search.value.results.results).toEqual([])
    expect(harness.search.value.results.status).toBe('exploring')
  })

  it('upserts repeated canonical URLs and rejects stale search IDs', () => {
    const harness = makeActions()
    const first = harness.actions.beginAgentSearch({ query: 'first search' })
    harness.actions.publishAgentProducts({ searchId: first.searchId, query: first.query, products: [asAgentInput()], complete: false })
    harness.actions.publishAgentProducts({ searchId: first.searchId, query: first.query, products: [asAgentInput()], complete: true })
    expect(harness.search.value.results.results).toHaveLength(1)

    const second = harness.actions.beginAgentSearch({ query: 'second search' })
    expect(() => harness.actions.publishAgentProducts({ searchId: first.searchId, query: first.query, products: [asAgentInput()] })).toThrow('stale')
    expect(second.searchId).not.toBe(first.searchId)
  })

  it('rejects placeholder and search/social URLs', () => {
    const harness = makeActions()
    const started = harness.actions.beginAgentSearch({ query: 'real products only' })
    const invalid = { ...asAgentInput(), url: 'https://example.com/fake-product' }
    expect(() => harness.actions.publishAgentProducts({ searchId: started.searchId, query: started.query, products: [invalid] })).toThrow('No products were accepted')
  })

  it('builds a deep multi-store plan and narrows it when stores are named', () => {
    const harness = makeActions()
    const broad = harness.actions.beginAgentSearch({ query: 'relaxed dinner outfit under $180' }, 'deep')
    expect(broad.targets.length).toBeGreaterThan(25)
    expect(broad.targets.some(target => target.name === 'Pinterest')).toBe(true)
    expect(broad.targets.some(target => target.name === 'Good American')).toBe(true)

    const specific = harness.actions.beginAgentSearch({ query: 'dinner dresses from Fashion Nova and SHEIN' }, 'deep')
    expect(specific.targets.map(target => target.retailerId)).toEqual(['fashion-nova', 'shein'])
  })

  it('refuses to finish while planned retailers are still pending', () => {
    const harness = makeActions()
    const started = harness.actions.beginAgentSearch({ query: 'Fashion Nova and SHEIN dinner pieces' }, 'deep')
    harness.actions.reportResearchTarget({ searchId: started.searchId, targetId: 'target:fashion-nova', status: 'complete' })
    const result = harness.actions.finishAgentSearch(started.searchId)
    expect(result.finished).toBe(false)
    expect(result.pendingTargets.map(target => target.id)).toEqual(['target:shein'])
    expect(harness.search.value.results.status).toBe('exploring')
  })

  it('accumulates batches from different retailers and tracks each target independently', () => {
    const harness = makeActions()
    const started = harness.actions.beginAgentSearch({ query: 'Fashion Nova and SHEIN dinner pieces' }, 'deep')
    harness.actions.publishAgentProducts({ searchId: started.searchId, query: started.query, targetId: 'target:fashion-nova', targetComplete: true, products: [asAgentInput(PRODUCTS[0])] })
    harness.actions.publishAgentProducts({ searchId: started.searchId, query: started.query, targetId: 'target:shein', targetComplete: true, products: [asAgentInput(PRODUCTS[3])] })

    expect(harness.search.value.results.results).toHaveLength(2)
    expect(harness.search.value.results.results.map(product => product.retailer)).toEqual(['Fashion Nova', 'SHEIN'])
    expect(harness.search.value.results.status).toBe('exploring')
    expect(harness.actions.getResearchProgress().targets.every(target => target.status === 'complete')).toBe(true)
    expect(harness.actions.finishAgentSearch(started.searchId).pendingTargets).toEqual([])
    expect(harness.search.value.results.status).toBe('success')
  })

  it('resets all THREAD-owned browser state', () => {
    const harness = makeActions()
    harness.actions.addToCart(PRODUCTS[0]!.id)
    harness.actions.beginAgentSearch({ query: 'dinner pieces' })
    harness.actions.resetWorkspace()
    expect(harness.profile.value).toBeNull()
    expect(harness.cart.value.items).toEqual([])
    expect(harness.agentProducts.value.products).toEqual([])
    expect(harness.search.value.results.hasSearched).toBe(false)
    expect(harness.storage.getItem('thread.profile.v1')).toBeNull()
    expect(harness.storage.getItem('thread.cart.v1')).toBeNull()
    expect(harness.storage.getItem('thread.products.agent.v1')).toBeNull()
  })
})
