import { describe, expect, it } from 'vitest'
import { createSearchMission } from '../app/domain/search/mission'
import { createResearchTargets } from '../app/domain/research/scheduler'
import { buildCatalogRequests } from '../app/domain/research/shopRequests'
import { DEFAULT_PROFILE, makeActions } from './helpers'
import { hydrateSearchState } from '../app/domain/persistence'

const brief = "i'm thinking of going to a friends engagement dinner, i need aldo shoes under $200 cad, also find a perfume for me, go to zara get me a coat and shirt for this dinner, my budget is $650, show me the recommendations."
const profile = { ...DEFAULT_PROFILE, shoppingDepartment: 'men' as const }

describe('mixed store dinner mission regressions', () => {
  it('preserves the actual brief without agent repair: four items, a local shoe cap, total budget and per-item stores', () => {
    const mission = createSearchMission({ rawPrompt: brief }, profile)
    expect(mission.needs.map(need => [need.intent, need.quantity])).toEqual([['shoes', 1], ['perfume', 1], ['coat', 1], ['shirt', 1]])
    expect(mission.constraints.overallBudgetCad).toBe(650)
    expect(mission.constraints.maxPriceCad).toBeUndefined()
    expect(mission.needs[0]!.budgetCad).toBe(200)
    const requests = mission.needs.map(need => buildCatalogRequests(need, mission, profile)[0]!.arguments.catalog)
    expect(requests[0]!.filters!.shops).toEqual(['aldoshoes.com'])
    expect(requests[0]!.filters!.price!.max).toBe(20000)
    expect(requests[1]!.filters!.shops).toBeUndefined()
    expect(requests[2]!.filters!.shops).toEqual(['zara.com'])
    expect(requests[2]!.filters!.price!.max).toBeGreaterThan(20000)
    expect(requests[3]!.filters!.shops).toEqual(['zara.com'])
    const targets = createResearchTargets(mission, profile)
    expect(targets.find(target => target.id === 'target:aldo')!.needIds).toEqual([mission.needs[0]!.id])
    expect(targets.find(target => target.id === 'target:zara')!.needIds).not.toContain(mission.needs[0]!.id)
    expect(targets.find(target => target.id === 'target:simons')!.needIds).toEqual([mission.needs[1]!.id])
  })

  it('retains Zara when resolving an unfamiliar store and keeps that store attached only to the shoes', () => {
    const { actions } = makeActions({ profile })
    const started = actions.startShoppingSearch({ rawPrompt: 'Find shoes from TruClothing, a coat and shirt from Zara, budget $650 CAD' })
    const resolved = actions.resolveStore({ searchId: started.searchId, name: 'TruClothing', domain: 'truclothing.com' })
    expect(() => structuredClone(resolved)).not.toThrow()
    const status = actions.getSearchStatus(started.searchId)!
    expect(status.targets.some(target => target.id === 'target:zara')).toBe(true)
    expect(status.targets.find(target => target.id === 'store:truclothing.com')!.needIds).toEqual([status.mission.needs[0]!.id])
    expect(status.targets.find(target => target.id === `catalog:${status.mission.needs[0]!.id}`)!.catalogRequests![0]!.arguments.catalog.filters!.shops).toEqual(['truclothing.com'])
  })

  it('rejects a Zara shoe falsely assigned to the Aldo need but allows a Zara coat above the shoe cap', () => {
    const { actions } = makeActions({ profile })
    const started = actions.startShoppingSearch({ rawPrompt: brief })
    const targets = actions.claimSearchTargets({ searchId: started.searchId, limit: 4 }).targets
    const candidate = { name: 'Leather loafers', url: 'https://www.zara.com/ca/en/leather-loafers-p12345678.html', image: 'https://static.zara.net/shoe.jpg', shoppingDepartment: 'men' as const, shop: { productId: 'gid://shopify/p/123', sellerDomain: 'zara.myshopify.com', sellerUrl: 'https://www.zara.com', price: { amount: 15000, currency: 'CAD' }, available: true } }
    expect(actions.publishCandidates({ searchId: started.searchId, targetId: targets[0]!.id, candidates: [{ ...candidate, category: 'footwear' }] }).rejected[0]!.reason).toContain('store restriction')
    const coatTarget = targets.find(target => target.needIds.includes(started.mission.needs[2]!.id))!
    const result = actions.publishCandidates({ searchId: started.searchId, targetId: coatTarget.id, candidates: [{ ...candidate, name: 'Wool coat', category: 'outerwear', url: 'https://www.zara.com/ca/en/wool-coat-p12345679.html', shop: { ...candidate.shop, price: { amount: 26900, currency: 'CAD' } } }] })
    expect(result.rejected).toEqual([])
    expect(result.accepted[0]!.priceCad).toBe(269)
  })

  it('uses the visitor country without leaking identity or measurements into Shop requests', () => {
    const visitor = { ...profile, destination: { country: 'GB', region: 'ENG' }, racialIdentity: 'private', heightCm: 180 }
    const mission = createSearchMission({ rawPrompt: 'Find a shirt for dinner, budget $100 CAD' }, visitor)
    const request = buildCatalogRequests(mission.needs[0]!, mission, visitor)[0]!
    expect(request.arguments.catalog.context).toMatchObject({ address_country: 'GB', address_region: 'ENG', currency: 'CAD' })
    expect(JSON.stringify(request)).not.toContain('private')
    expect(JSON.stringify(request)).not.toContain('180')
  })

  it('preserves per-need stores, open fragrance search and budget ceilings across a page reload', () => {
    const harness = makeActions({ profile })
    const started = harness.actions.startShoppingSearch({ rawPrompt: brief })
    const restored = hydrateSearchState(JSON.parse(JSON.stringify(harness.search.value)))
    expect(restored.activeSearch!.mission.needs).toEqual(started.mission.needs)
    const perfume = restored.activeSearch!.mission.needs[1]!
    expect(buildCatalogRequests(perfume, restored.activeSearch!.mission, profile)[0]!.arguments.catalog.filters!.shops).toBeUndefined()
  })

  it('keeps explicit global store restrictions authoritative over inferred clause scopes', () => {
    const mission = createSearchMission({ rawPrompt: brief, constraints: { retailerIds: ['zara'] } }, profile)
    expect(buildCatalogRequests(mission.needs[0]!, mission, profile)[0]!.arguments.catalog.filters!.shops).toEqual(['zara.com'])
  })
})
