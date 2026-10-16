import { describe, expect, it } from 'vitest'
import { parseBrief, parseBudget } from '../app/domain/search/briefParser'
import { createSearchMission } from '../app/domain/search/mission'
import { allocateBudget, searchPriceCapCad } from '../app/domain/search/priceModel'
import { DEFAULT_PROFILE, FLAGSHIP_BRIEF } from './helpers'

describe('brief parsing', () => {
  it('reads every item, quantity, the basket budget, and the destination from the flagship brief', () => {
    const brief = parseBrief(FLAGSHIP_BRIEF)
    expect(brief.items.map(item => [item.phrase, item.quantity, item.group])).toEqual([
      ['clothes', 3, 'clothes'],
      ['perfume', 1, 'category'],
      ['footwears', 2, 'category'],
    ])
    expect(brief.budget).toEqual({ amountCad: 450, scope: 'total' })
    expect(brief).toMatchObject({ destination: 'Cancun', climate: 'hot' })
  })

  it.each([
    ['Find me a black shirt under $70 CAD', { amountCad: 70, scope: 'each' }],
    ['two dresses, $300 total', { amountCad: 300, scope: 'total' }],
    ['three linen shirts at $60 each', { amountCad: 60, scope: 'each' }],
    ['a pair of sandals and a swimsuit for 150 cad', { amountCad: 150, scope: 'total' }],
    ['I can spend CAD 1,200 on a ski trip wardrobe', { amountCad: 1200, scope: 'total' }],
  ])('scopes the budget in “%s”', (prompt, budget) => {
    const brief = parseBrief(prompt)
    expect(parseBudget(prompt, brief.items.reduce((sum, item) => sum + item.quantity, 0) || 1)).toEqual(budget)
  })

  it('understands pairs, couples, digits, and descriptive words', () => {
    expect(parseBrief('two pairs of comfy sandals, a couple of tees and 4 white linen shirts').items.map(item => [item.hint ?? item.phrase, item.quantity]))
      .toEqual([['sandals', 2], ['t-shirt', 2], ['white linen shirt', 4]])
  })
})

describe('flagship mission plan', () => {
  const mission = createSearchMission({ rawPrompt: FLAGSHIP_BRIEF }, DEFAULT_PROFILE, '2026-10-13T12:00:00.000Z')

  it('creates one need per item with quantities, categories, and climate-aware searches', () => {
    expect(mission.needs.map(need => [need.intent, need.quantity, need.categories])).toEqual([
      ['clothes', 3, ['tops', 'bottoms', 'dresses', 'swimwear']],
      ['perfume', 1, ['fragrance']],
      ['footwear', 2, ['footwear']],
    ])
    expect(mission.needs[0]!.queries.slice(0, 3)).toEqual(['linen shirt', 'sundress', 'swimsuit'])
    expect(mission.needs[2]!.queries).toEqual(['flat sandals', 'espadrilles', 'slides'])
    expect(mission.needs[1]!.queries[0]).toBe('citrus eau de parfum')
    expect(mission.constraints).toMatchObject({ overallBudgetCad: 450, maxPriceCad: undefined })
    expect(mission.constraints.categories).toEqual(['tops', 'bottoms', 'dresses', 'swimwear', 'fragrance', 'footwear'])
    expect(mission.context).toMatchObject({ destination: 'Cancun', tripType: 'vacation' })
  })

  it('allocates the whole budget by category price priors and bounds each item by basket feasibility', () => {
    const allocated = mission.needs.reduce((sum, need) => sum + need.allocationCad!, 0)
    expect(allocated).toBeCloseTo(450, 0)
    const [clothes, perfume, footwear] = mission.needs
    expect(perfume!.allocationCad!).toBeGreaterThan(clothes!.allocationCad! / 3)
    expect(footwear!.allocationCad! / 2).toBeGreaterThan(clothes!.allocationCad! / 3)
    // Every other slot at its cheapest plausible price still leaves this much for one item.
    expect(perfume!.priceCeilingCad).toBe(450 - (3 * 15 + 2 * 30))
    expect(searchPriceCapCad(clothes!)).toBeLessThan(clothes!.priceCeilingCad!)
  })

  it('keeps stated per-need budgets and only allocates the remainder', () => {
    const needs = allocateBudget([
      { id: 'a', intent: 'dress', queries: ['dress'], categories: ['dresses'], required: true, quantity: 1, budgetCad: 100 },
      { id: 'b', intent: 'shoes', queries: ['sandals'], categories: ['footwear'], required: true, quantity: 1 },
    ], 250)
    expect(needs[0]).toMatchObject({ allocationCad: 100, budgetCad: 100 })
    expect(needs[1]!.allocationCad).toBe(150)
  })

  it('never lets a usual per-item budget override a stated basket budget', () => {
    const planned = createSearchMission({ rawPrompt: FLAGSHIP_BRIEF }, { ...DEFAULT_PROFILE, usualBudgetCad: 60 })
    expect(planned.constraints.maxPriceCad).toBeUndefined()
  })

  it('keeps the richer vacation plan when no items are counted', () => {
    const planned = createSearchMission({ rawPrompt: 'Get my clothes for vacation in Cancun.' }, DEFAULT_PROFILE)
    expect(planned.needs.map(need => need.intent)).toEqual(['resort daytime', 'beach and pool', 'evening dinner'])
  })

  it('drops dresses for men and adds outerwear for cold trips', () => {
    const men = createSearchMission({ rawPrompt: 'three clothes for Tulum' }, { ...DEFAULT_PROFILE, shoppingDepartment: 'men' })
    expect(men.needs[0]!.categories).toEqual(['tops', 'bottoms', 'swimwear'])
    const ski = createSearchMission({ rawPrompt: 'two outfits and boots for Banff' }, DEFAULT_PROFILE)
    expect(ski.needs.map(need => need.categories)).toEqual([['tops', 'bottoms', 'dresses', 'outerwear'], ['footwear']])
  })
})
