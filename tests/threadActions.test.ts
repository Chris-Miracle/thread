import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { CART_STORAGE_KEY, PROFILE_STORAGE_KEY, SEARCH_STORAGE_KEY } from '../app/utils/storage'
import { candidateFromFixture, makeActions, makeStorage, startRestrictedSearch } from './helpers'
import { STYLE_OPTIONS } from '../app/types/thread'

const fashionNovaProducts = PRODUCTS.filter(product => product.retailerId === 'fashion-nova' && product.shoppingDepartment === 'women')
const sheinProducts = PRODUCTS.filter(product => product.retailerId === 'shein')
const uniqlo = PRODUCTS.find(product => product.retailerId === 'uniqlo' && product.shoppingDepartment === 'women')!

describe('profile evolution and migration', () => {
  it('offers exactly 15 Copnow-aligned styles and enforces 3 to 10 human selections', () => {
    expect(STYLE_OPTIONS).toHaveLength(15)
    const harness = makeActions({ profile: null })
    expect(() => harness.actions.saveStyleProfile({
      name: 'Chris', shoppingDepartment: 'men', styles: ['minimal', 'smart-casual'],
    })).toThrow('at least 3')
    expect(() => harness.actions.saveStyleProfile({
      name: 'Chris',
      shoppingDepartment: 'men',
      styles: STYLE_OPTIONS.slice(0, 11).map(style => style.id),
    })).toThrow('up to 10')
  })

  it('preserves explicitly supplied identity, measurements, and clothing sizes without inference', () => {
    const harness = makeActions({ profile: null })
    const profile = harness.actions.saveStyleProfile({
      name: 'Chris',
      shoppingDepartment: 'men',
      styles: ['minimal', 'smart-casual', 'old-money'],
      genderIdentity: 'man',
      racialIdentity: 'Black',
      heightCm: 180.34,
      weightKg: 81,
      clothingSizes: { tops: 'L', bottoms: 'XL' },
    })
    expect(profile).toMatchObject({
      version: 4,
      genderIdentity: 'man',
      racialIdentity: 'Black',
      heightCm: 180.34,
      weightKg: 81,
      clothingSizes: { tops: 'L', bottoms: 'XL' },
    })
  })

  it('migrates the legacy profile schema to version 4', () => {
    const storage = makeStorage({
      'thread.profile.v1': JSON.stringify({ version: 2, name: 'Chris', gender: 'women', styles: ['minimal'] }),
    })
    const harness = makeActions({ profile: null, storage, hydrated: false })
    harness.actions.hydrate()
    expect(harness.profile.value).toMatchObject({
      version: 4,
      name: 'Chris',
      shoppingDepartment: 'women',
      styles: ['minimal'],
    })
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toContain('"version":4')
  })

  it('keeps onboarding minimal and supports incremental optional preferences', () => {
    const harness = makeActions({ profile: null })
    expect(harness.actions.setupProfile({ name: 'Alex', shoppingDepartment: 'all' })).toMatchObject({ status: 'created' })
    const updated = harness.actions.updateProfile({
      preferredFit: 'relaxed',
      preferredColours: ['navy', 'white'],
      usualBudgetCad: 180,
      preferredRetailerIds: ['cos'],
    })
    expect(updated).toMatchObject({
      name: 'Alex',
      styles: [],
      preferredFit: 'relaxed',
      preferredColours: ['navy', 'white'],
      usualBudgetCad: 180,
      preferredRetailerIds: ['cos'],
    })
  })

  it('preserves an existing profile unless replacement is explicit', () => {
    const harness = makeActions()
    expect(harness.actions.setupProfile({ name: 'Someone Else', shoppingDepartment: 'men' }).status).toBe('existing')
    expect(harness.profile.value?.name).toBe('Chris')
    expect(harness.actions.setupProfile({ name: 'Alex', shoppingDepartment: 'men', replaceExisting: true }).status).toBe('updated')
    expect(harness.profile.value?.shoppingDepartment).toBe('men')
  })
})

describe('search persistence, pagination, cancellation, and telemetry', () => {
  it('persists the active mission, queue, candidates, and progress across hydration', () => {
    const storage = makeStorage()
    const first = makeActions({ storage })
    const started = startRestrictedSearch(first, ['fashion-nova'])
    const target = first.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    first.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [candidateFromFixture(fashionNovaProducts[0]!)],
    })
    expect(storage.getItem(SEARCH_STORAGE_KEY)).toContain(started.searchId)

    const second = makeActions({ profile: null, storage, hydrated: false })
    second.actions.hydrate()
    expect(second.search.value.activeSearch).toMatchObject({
      id: started.searchId,
      status: 'active',
      products: [{ id: fashionNovaProducts[0]!.id }],
    })
    expect(second.search.value.activeSearch?.targets[0]?.status).toBe('exploring')
  })

  it('supports cursor pagination beyond a small first slice', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova', 'shein'])
    const targets = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 2 }).targets
    for (const target of targets) {
      const products = target.retailerId === 'fashion-nova' ? fashionNovaProducts : sheinProducts
      harness.actions.publishCandidates({
        searchId: started.searchId,
        targetId: target.id,
        candidates: products.map(candidateFromFixture),
      })
    }
    const first = harness.actions.getProducts({ searchId: started.searchId, limit: 2 })
    const second = harness.actions.getProducts({ searchId: started.searchId, cursor: first.nextCursor ?? undefined, limit: 2 })
    expect(first.products).toHaveLength(2)
    expect(second.products).toHaveLength(2)
    expect(second.products.map(product => product.id)).not.toEqual(first.products.map(product => product.id))
    expect(first.total).toBeGreaterThan(4)
  })

  it('cancels unresolved targets while preserving accepted products', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova', 'shein'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const fixture = target.retailerId === 'fashion-nova' ? fashionNovaProducts[0]! : sheinProducts[0]!
    harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [candidateFromFixture(fixture)] })
    const cancelled = harness.actions.cancelSearch(started.searchId, 'User changed plans.')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.coverage.unresolvedTargets).toBe(0)
    expect(harness.actions.getProducts({ searchId: started.searchId }).products).toHaveLength(1)
    expect(() => harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [candidateFromFixture(fixture)] })).toThrow('cancelled')
  })

  it('can explicitly mark a search abandoned', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova'])
    expect(harness.actions.cancelSearch(started.searchId, 'Agent was asked to abandon this pass.', 'abandoned').status).toBe('abandoned')
  })

  it('records a bounded local execution trace with acceptance and failure reasons', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [
        candidateFromFixture(fashionNovaProducts[0]!),
        candidateFromFixture(sheinProducts[0]!),
      ],
    })
    const types = harness.actions.getExecutionTrace().map(event => event.type)
    expect(types).toEqual(expect.arrayContaining([
      'search_started',
      'mission_created',
      'targets_ranked',
      'targets_claimed',
      'target_started',
      'candidate_received',
      'candidate_accepted',
      'candidate_rejected',
    ]))
    expect(harness.actions.getExecutionTrace().length).toBeLessThanOrEqual(250)
  })
})

describe('variant-stable cross-store cart', () => {
  it('requires enrichment and explicit known variants before adding', () => {
    const harness = makeActions()
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Find a UNIQLO shirt',
      constraints: { retailerIds: ['uniqlo'] },
    })
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const candidate = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [candidateFromFixture(uniqlo)],
    }).accepted[0]!
    expect(() => harness.actions.addToCart(candidate.id)).toThrow('enrichment')
    harness.actions.enrichProduct(started.searchId, {
      productId: candidate.id,
      colors: uniqlo.colors,
      sizes: uniqlo.sizes,
      category: uniqlo.category,
      shoppingDepartment: uniqlo.shoppingDepartment,
      priceCad: uniqlo.priceCad,
      availability: 'in-stock',
    })
    expect(() => harness.actions.addToCart(candidate.id)).toThrow('Select a size')
    expect(() => harness.actions.addToCart(candidate.id, { size: 'M' })).toThrow('Select a colour')
  })

  it('uses deterministic product + variant identity and CAD totals', () => {
    const harness = makeActions()
    const first = harness.actions.addToCart(uniqlo.id, { size: 'M', color: 'Off White' })
    const duplicate = harness.actions.addToCart(uniqlo.id, { size: 'M', color: 'Off White' })
    const secondVariant = harness.actions.addToCart(uniqlo.id, { size: 'L', color: 'Off White' })
    expect(duplicate.duplicate).toBe(true)
    expect(secondVariant.item.id).not.toBe(first.item.id)
    expect(harness.actions.getCart()).toMatchObject({
      itemCount: 2,
      totals: [{ currency: 'CAD', subtotal: 99.8 }],
      unpricedItemCount: 0,
    })
    expect(harness.actions.removeFromCart(first.item.id)).toBe(true)
  })

  it('adds fixed-listing fragrance without leaking apparel variants into the cart', () => {
    const fragrance = {
      ...uniqlo,
      id: 'product:fragrance:test',
      name: 'Cedar Veil EDP 100 ml',
      category: 'fragrance' as const,
      colors: ['Amber bottle'],
      sizes: ['100 ml'],
    }
    const harness = makeActions({ fixtures: [fragrance] })
    const first = harness.actions.addToCart(fragrance.id, { size: 'L', color: 'Black' }, 'agent')
    const duplicate = harness.actions.addToCart(fragrance.id)

    expect(first).toMatchObject({
      success: true,
      duplicate: false,
      item: { productId: fragrance.id, size: undefined, color: undefined },
    })
    expect(duplicate).toMatchObject({ duplicate: true, item: { id: first.item.id } })
    expect(harness.actions.getCart().itemCount).toBe(1)
  })

  it('ignores unsupported variant dimensions but still validates real accessory choices', () => {
    const fixedAccessory = {
      ...uniqlo,
      id: 'product:accessory:fixed',
      name: 'Silver cuff',
      category: 'accessories' as const,
      colors: [],
      sizes: [],
    }
    const colourAccessory = {
      ...fixedAccessory,
      id: 'product:accessory:colour',
      name: 'Leather card holder',
      colors: ['Black', 'Brown'],
    }
    const fixedVariantAccessory = {
      ...fixedAccessory,
      id: 'product:accessory:fixed-variant',
      name: 'Single-variant card holder',
      colors: ['Black'],
      sizes: ['ONE SIZE'],
    }
    const harness = makeActions({ fixtures: [fixedAccessory, colourAccessory, fixedVariantAccessory] })

    expect(harness.actions.addToCart(fixedAccessory.id, { size: 'XL', color: 'Green' }).item)
      .toMatchObject({ size: undefined, color: undefined })
    expect(() => harness.actions.addToCart(colourAccessory.id)).toThrow('Select a colour')
    expect(() => harness.actions.addToCart(colourAccessory.id, { color: 'Green' })).toThrow('not an available colour')
    expect(harness.actions.addToCart(colourAccessory.id, { color: 'Black' }).item.color).toBe('Black')
    expect(harness.actions.addToCart(fixedVariantAccessory.id, { size: 'XL', color: 'Green' }).item)
      .toMatchObject({ size: 'ONE SIZE', color: 'Black' })
  })
})

describe('complete shared human-agent workflow', () => {
  it('runs start → claim → publish → enrich → complete → rank → cart end to end', () => {
    const harness = makeActions()
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Get my clothes for vacation in Cancun under $180 CAD',
      constraints: { maxPriceCad: 180, retailerIds: ['fashion-nova', 'shein', 'uniqlo'] },
    })
    const targets = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 3, workerId: 'integration' }).targets
    expect(targets).toHaveLength(3)
    for (const target of targets) {
      const fixture = target.retailerId === 'fashion-nova'
        ? fashionNovaProducts[0]!
        : target.retailerId === 'shein'
          ? sheinProducts[0]!
          : uniqlo
      const accepted = harness.actions.publishCandidates({
        searchId: started.searchId,
        targetId: target.id,
        candidates: [candidateFromFixture(fixture)],
      }).accepted[0]!
      harness.actions.enrichProduct(started.searchId, {
        productId: accepted.id,
        colors: fixture.colors,
        sizes: fixture.sizes,
        category: fixture.category,
        shoppingDepartment: fixture.shoppingDepartment,
        nativePrice: fixture.nativePrice,
        nativeCurrency: fixture.nativeCurrency,
        priceCad: fixture.priceCad,
        description: fixture.description,
        availability: fixture.availability,
      })
      harness.actions.completeSearchTarget({
        searchId: started.searchId,
        targetId: target.id,
        status: 'complete',
        note: 'Listing and product page checked.',
      })
    }
    const status = harness.actions.getSearchStatus(started.searchId)
    expect(status.status).toBe('completed')
    expect(status.coverage).toMatchObject({ completedTargets: 3, unresolvedTargets: 0 })
    const products = harness.actions.getProducts({ searchId: started.searchId, limit: 100 }).products
    expect(new Set(products.map(product => product.retailerId)).size).toBe(3)
    const selected = products[0]!
    harness.actions.addToCart(selected.id, { size: selected.sizes[0], color: selected.colors[0] }, 'agent')
    expect(harness.actions.getCart().itemCount).toBe(1)
    expect(harness.storage.getItem(CART_STORAGE_KEY)).toContain(selected.id)
  })

  it('resets every current and legacy THREAD-owned browser key', () => {
    const storage = makeStorage({
      'thread.profile.v1': '{}',
      'thread.cart.v1': '{}',
      'thread.products.agent.v1': '{}',
    })
    const harness = makeActions({ storage })
    startRestrictedSearch(harness, ['fashion-nova'])
    harness.actions.resetWorkspace()
    expect([...storage.values.keys()]).toEqual([])
    expect(harness.profile.value).toBeNull()
    expect(harness.search.value.activeSearch).toBeNull()
    expect(harness.cart.value.items).toEqual([])
  })
})
