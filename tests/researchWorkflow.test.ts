import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { canonicalizeProductUrl } from '../app/domain/productIdentity'
import { claimSearchTargets as claimPlannedTargets, createResearchTargets } from '../app/domain/research/scheduler'
import { createSearchMission } from '../app/domain/search/mission'
import type { SearchSession } from '../app/types/thread'
import { candidateFromFixture, DEFAULT_PROFILE, makeActions, startRestrictedSearch } from './helpers'

const fashionNova = PRODUCTS.find(product => product.retailerId === 'fashion-nova' && product.shoppingDepartment === 'women')!
const shein = PRODUCTS.find(product => product.retailerId === 'shein')!
const uniqlo = PRODUCTS.find(product => product.retailerId === 'uniqlo')!

describe('research queue lifecycle', () => {
  it('uses only retailer-supported need queries and reprioritizes the unmet fragrance need', () => {
    const mission = createSearchMission({
      rawPrompt: 'Clothes and fragrance for a weekend away.',
      shoppingDepartment: 'men',
      needs: [
        { intent: 'clothes', queries: ['summer shirt'], categories: ['tops'], quantity: 1 },
        { intent: 'fragrance', queries: ['mens fragrance'], categories: ['fragrance'], quantity: 1 },
      ],
    }, { ...DEFAULT_PROFILE, shoppingDepartment: 'men' }, '2026-08-31T12:00:00.000Z')
    const targets = createResearchTargets(mission, { ...DEFAULT_PROFILE, shoppingDepartment: 'men' })
    expect(targets.find(target => target.retailerId === 'uniqlo')?.queries).toEqual(['summer shirt'])
    expect(targets.find(target => target.retailerId === 'zara')?.queries).toEqual(['summer shirt', 'mens fragrance'])
    const session = {
      version: 1,
      id: 'search:adaptive',
      status: 'active',
      mission,
      targets,
      products: [],
      rankings: [],
      fulfillment: {
        needs: [
          { needId: mission.needs[0]!.id, intent: 'clothes', required: true, requiredQuantity: 1, matchedProductIds: ['product:shirt'], selectedProductIds: ['product:shirt'], subtotalCad: 40, satisfied: true },
          { needId: mission.needs[1]!.id, intent: 'fragrance', required: true, requiredQuantity: 1, matchedProductIds: [], selectedProductIds: [], subtotalCad: 0, satisfied: false },
        ],
        selectedProductIds: ['product:shirt'],
        subtotalCad: 40,
        satisfied: false,
      },
      acceptedCandidateCount: 1,
      rejectedCandidateCount: 0,
      telemetry: [],
      createdAt: mission.createdAt,
      updatedAt: mission.createdAt,
      completedAt: null,
      cancellationReason: null,
      revision: 1,
    } satisfies SearchSession
    const claimed = claimPlannedTargets(session, 4, 'adaptive-worker', mission.createdAt).claimed
    expect(claimed).toHaveLength(4)
    expect(claimed.every(target => target.needIds.includes(mission.needs[1]!.id))).toBe(true)
    expect(claimed.every(target => target.priorityReasons.some(reason => reason.includes('fragrance')))).toBe(true)
  })

  it('keeps the broad target plan, satisfies the requested basket, and records every unneeded target as skipped', () => {
    const harness = makeActions({ profile: {
      ...makeActions().profile.value!,
      shoppingDepartment: 'men',
      styles: ['minimal', 'smart-casual', 'old-money'],
      usualBudgetCad: 170,
    } })
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Find three clothes and a perfume for a Cancun weekend, total CAD 170.',
      shoppingDepartment: 'men',
      needs: [
        { intent: 'three clothes', queries: ['summer shirt', 'relaxed trousers'], categories: ['tops', 'bottoms'], quantity: 3, budgetCad: 120 },
        { intent: 'perfume', queries: ['mens fragrance'], categories: ['fragrance'], quantity: 1, budgetCad: 50 },
      ],
      constraints: { overallBudgetCad: 170 },
    })
    expect(started.coverage.totalTargets).toBeGreaterThan(20)
    const totalTargets = started.coverage.totalTargets
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const clothesNeed = started.mission.needs.find(need => need.intent === 'three clothes')!
    const fragranceNeed = started.mission.needs.find(need => need.intent === 'perfume')!
    expect(target.needIds).toEqual(expect.arrayContaining([clothesNeed.id, fragranceNeed.id]))
    const domain = target.searchUrls[0] ? new URL(target.searchUrls[0]).hostname : 'zara.com'
    const base = `https://${domain}/product/thread-test`
    const result = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [
        { url: `${base}-shirt`, name: 'Summer shirt', category: 'tops', shoppingDepartment: 'men', priceCad: 40, needIds: [clothesNeed.id] },
        { url: `${base}-trouser`, name: 'Relaxed trousers', category: 'bottoms', shoppingDepartment: 'men', priceCad: 40, needIds: [clothesNeed.id] },
        { url: `${base}-polo`, name: 'Knit polo', category: 'tops', shoppingDepartment: 'men', priceCad: 40, needIds: [clothesNeed.id] },
        { url: `${base}-fragrance`, name: 'Weekend fragrance', category: 'fragrance', shoppingDepartment: 'men', priceCad: 50, needIds: [fragranceNeed.id] },
      ],
    })
    expect(result.rejected).toEqual([])
    expect(result.accepted).toHaveLength(4)
    const completed = harness.actions.completeSearchTarget({
      searchId: started.searchId,
      targetId: target.id,
      status: 'complete',
      note: 'Observed four grounded products.',
    })
    expect(completed.searchStatus).toBe('satisfied')
    expect(completed.coverage).toMatchObject({ totalTargets, completedTargets: 1, skippedTargets: totalTargets - 1, unresolvedTargets: 0 })
    expect(completed.fulfillment).toMatchObject({ satisfied: true, subtotalCad: 170, overallBudgetCad: 170 })
  })

  it('creates ranked queued targets and claims bounded batches', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova', 'shein'])
    expect(started.coverage.queuedTargets).toBe(2)
    const claim = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1, workerId: 'worker-a' })
    expect(claim.targets).toHaveLength(1)
    expect(claim.targets[0]).toMatchObject({ status: 'claimed', claimedBy: 'worker-a' })
    expect(claim.coverage).toMatchObject({ queuedTargets: 1, claimedTargets: 1 })
    expect(() => harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 })).toThrow('Resolve the 1 claimed')
  })

  it('never claims more than four targets and returns the next ranked queue slice', () => {
    const harness = makeActions()
    const started = harness.actions.startShoppingSearch({ rawPrompt: 'vacation in Cancun' })
    expect(() => harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 5 })).toThrow('between 1 and 4')
    const claimed = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 4 })
    expect(claimed.targets.map(target => target.rank)).toEqual([1, 2, 3, 4])
  })

  it('requires semantic zero-result and failure states', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova', 'shein'])
    const claimed = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 2 })
    expect(() => harness.actions.completeSearchTarget({
      searchId: started.searchId,
      targetId: claimed.targets[0]!.id,
      status: 'complete',
    })).toThrow('zero accepted')
    expect(() => harness.actions.completeSearchTarget({
      searchId: started.searchId,
      targetId: claimed.targets[0]!.id,
      status: 'no-results',
    })).toThrow('short reason')
    const empty = harness.actions.completeSearchTarget({
      searchId: started.searchId,
      targetId: claimed.targets[0]!.id,
      status: 'no-results',
      note: 'Listing had no relevant products within budget.',
    })
    const failed = harness.actions.completeSearchTarget({
      searchId: started.searchId,
      targetId: claimed.targets[1]!.id,
      status: 'failed',
      note: 'Retailer navigation failed.',
    })
    expect(empty.target.status).toBe('no-results')
    expect(failed.target.status).toBe('failed')
    expect(failed.searchStatus).toBe('completed')
  })

  it('moves claimed targets to exploring on first publication', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova', 'shein'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [candidateFromFixture(target.retailerId === 'fashion-nova' ? fashionNova : shein)],
    })
    expect(harness.search.value.activeSearch?.targets.find(item => item.id === target.id)?.status).toBe('exploring')
  })
})

describe('candidate integrity and hard constraints', () => {
  it('rejects publication when no active search exists', () => {
    const harness = makeActions()
    expect(() => harness.actions.publishCandidates({
      searchId: 'search:missing',
      targetId: 'target:fashion-nova',
      candidates: [candidateFromFixture(fashionNova)],
    })).toThrow('No shopping search')
  })

  it('preserves the active mission and archives it only after an explicit terminal action', () => {
    const harness = makeActions()
    const first = startRestrictedSearch(harness, ['fashion-nova'])
    harness.actions.claimSearchTargets({ searchId: first.searchId, limit: 1 })
    expect(() => startRestrictedSearch(harness, ['shein'])).toThrow('already active')
    harness.actions.cancelSearch(first.searchId, 'Moving to a different mission.')
    const second = startRestrictedSearch(harness, ['shein'])
    expect(harness.search.value.recentSearches.map(search => search.id)).toContain(first.searchId)
    expect(() => harness.actions.publishCandidates({
      searchId: first.searchId,
      targetId: 'target:fashion-nova',
      candidates: [candidateFromFixture(fashionNova)],
    })).toThrow('previous read-only mission')
    expect(second.searchId).not.toBe(first.searchId)
  })

  it('rejects a target/domain mismatch and discovery/search URLs', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const mismatch = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [candidateFromFixture(shein)],
    })
    expect(mismatch.rejected[0]?.reason).toContain('does not match target retailer')
    const searchUrl = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [{ ...candidateFromFixture(fashionNova), url: 'https://www.fashionnova.com/en-ca/pages/search-results?q=dress' }],
    })
    expect(searchUrl.rejected[0]?.reason).toContain('product page')
  })

  it('derives canonical retailer identity and canonical product identity', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const input = {
      ...candidateFromFixture(fashionNova),
      retailer: 'A fake submitted store',
      url: `${fashionNova.url}${fashionNova.url.includes('?') ? '&' : '?'}utm_source=worker`,
    }
    const accepted = harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [input] }).accepted[0]!
    expect(accepted.retailer).toBe('Fashion Nova')
    expect(accepted.retailerId).toBe('fashion-nova')
    expect(accepted.url).toBe(canonicalizeProductUrl(fashionNova.url))
    expect(accepted.id).toBe(fashionNova.id)
  })

  it('upserts duplicate canonical URLs without duplicating the registry', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    harness.actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [candidateFromFixture(fashionNova)] })
    harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [{ ...candidateFromFixture(fashionNova), name: 'Updated listing title', url: `${fashionNova.url}&utm_medium=test` }],
    })
    expect(harness.search.value.activeSearch?.products).toHaveLength(1)
    expect(harness.search.value.activeSearch?.products[0]?.name).toBe('Updated listing title')
    expect(harness.search.value.activeSearch?.targets[0]?.productCount).toBe(1)
  })

  it('enforces hard budget, department, and category constraints', () => {
    const budgetHarness = makeActions()
    const budgetSearch = budgetHarness.actions.startShoppingSearch({
      rawPrompt: 'Find dinner clothes under $40 CAD',
      constraints: { maxPriceCad: 40, retailerIds: ['fashion-nova'] },
    })
    const budgetTarget = budgetHarness.actions.claimSearchTargets({ searchId: budgetSearch.searchId, limit: 1 }).targets[0]!
    const overBudget = budgetHarness.actions.publishCandidates({
      searchId: budgetSearch.searchId,
      targetId: budgetTarget.id,
      candidates: [{ ...candidateFromFixture(fashionNova), nativePrice: 41, priceCad: 41 }],
    })
    expect(overBudget.rejected[0]?.reason).toContain('exceeds')

    const departmentHarness = makeActions()
    const departmentSearch = startRestrictedSearch(departmentHarness, ['fashion-nova'])
    const departmentTarget = departmentHarness.actions.claimSearchTargets({ searchId: departmentSearch.searchId, limit: 1 }).targets[0]!
    const wrongDepartment = departmentHarness.actions.publishCandidates({
      searchId: departmentSearch.searchId,
      targetId: departmentTarget.id,
      candidates: [{ ...candidateFromFixture(fashionNova), shoppingDepartment: 'men' }],
    })
    expect(wrongDepartment.rejected[0]?.reason).toContain('department')

    const categoryHarness = makeActions()
    const categorySearch = categoryHarness.actions.startShoppingSearch({
      rawPrompt: 'Find a black shirt under $70 CAD',
      constraints: { retailerIds: ['fashion-nova'] },
    })
    const categoryTarget = categoryHarness.actions.claimSearchTargets({ searchId: categorySearch.searchId, limit: 1 }).targets[0]!
    const wrongCategory = categoryHarness.actions.publishCandidates({
      searchId: categorySearch.searchId,
      targetId: categoryTarget.id,
      candidates: [{ ...candidateFromFixture(fashionNova), category: 'dresses', nativePrice: 35, priceCad: 35 }],
    })
    expect(wrongCategory.rejected[0]?.reason).toContain('category')
  })

  it('requires verified CAD normalization for non-CAD listings', () => {
    const harness = makeActions()
    const started = startRestrictedSearch(harness, ['fashion-nova'])
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const unsupported = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [{ ...candidateFromFixture(fashionNova), nativePrice: 50, nativeCurrency: 'USD', priceCad: undefined }],
    })
    expect(unsupported.rejected[0]?.reason).toContain('explicitly verified priceCad')
    const converted = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [{ ...candidateFromFixture(fashionNova), nativePrice: 50, nativeCurrency: 'USD', priceCad: 68 }],
    })
    expect(converted.accepted[0]).toMatchObject({ nativePrice: 50, nativeCurrency: 'USD', priceCad: 68 })
  })

  it('allows candidate-first publication and later enrichment', () => {
    const harness = makeActions()
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Find something interesting from UNIQLO',
      shoppingDepartment: 'all',
      constraints: { retailerIds: ['uniqlo'] },
    })
    const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const candidate = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [{ url: uniqlo.url, name: uniqlo.name }],
    }).accepted[0]!
    expect(candidate.stage).toBe('candidate')
    const enriched = harness.actions.enrichProduct(started.searchId, {
      productId: candidate.id,
      category: uniqlo.category,
      shoppingDepartment: uniqlo.shoppingDepartment,
      priceCad: uniqlo.priceCad,
      colors: uniqlo.colors,
      sizes: uniqlo.sizes,
      description: uniqlo.description,
      availability: 'in-stock',
    })
    expect(enriched).toMatchObject({ stage: 'enriched', priceCad: uniqlo.priceCad, availability: 'in-stock' })
  })
})
