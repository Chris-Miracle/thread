import { describe, expect, it } from 'vitest'
import { createSearchMission, inferMaxPriceCad } from '../app/domain/search/mission'
import { DEFAULT_PROFILE } from './helpers'

describe('SearchMission', () => {
  it('expands a Cancun vacation into concrete multi-need retailer queries', () => {
    const mission = createSearchMission({ rawPrompt: 'Get my clothes for vacation in Cancun.' }, DEFAULT_PROFILE, '2026-08-30T12:00:00.000Z')
    expect(mission.context).toMatchObject({
      tripType: 'vacation',
      destination: 'Cancun',
      climateHints: ['hot', 'humid', 'tropical'],
    })
    expect(mission.needs.map(need => need.intent)).toEqual(['resort daytime', 'beach and pool', 'evening dinner'])
    expect(mission.derivedQueries).toContain('linen dress')
    expect(mission.derivedQueries).toContain('sandals')
    expect(mission.derivedQueries).toContain('resort dinner dress')
    expect(mission.rawPrompt).toBe('Get my clothes for vacation in Cancun.')
  })

  it('normalizes a simple black shirt mission and stores a hard category and budget', () => {
    const mission = createSearchMission({ rawPrompt: 'Find me a black shirt under $70 CAD.' }, DEFAULT_PROFILE)
    expect(mission.constraints.maxPriceCad).toBe(70)
    expect(mission.constraints.categories).toEqual(['tops'])
    expect(mission.needs[0]?.queries[0]).toBe('a black shirt under $70 CAD.')
  })

  it('preserves structured agent-supplied needs instead of replacing them', () => {
    const mission = createSearchMission({
      rawPrompt: 'Help with a warm-weather trip',
      context: { destination: 'Barbados', climateHints: ['hot', 'humid'], occasions: ['vacation'] },
      needs: [
        { intent: 'daytime', queries: ['linen co-ord', 'breathable shirt'], categories: ['tops', 'bottoms'] },
        { intent: 'dinner', queries: ['resort dinner dress'], categories: ['dresses'] },
      ],
    }, DEFAULT_PROFILE)
    expect(mission.context.destination).toBe('Barbados')
    expect(mission.derivedQueries).toEqual(['linen co-ord', 'breathable shirt', 'resort dinner dress'])
  })

  it('does not misclassify holiday dinner shopping as a vacation', () => {
    const mission = createSearchMission({
      rawPrompt: 'Find a warm fragrance and card holder for holiday dinners.',
      context: { occasions: ['dinner', 'formal'] },
      needs: [
        { intent: 'evening fragrance', queries: ['warm woody fragrance'], categories: ['fragrance'] },
        { intent: 'card holder', queries: ['minimal leather card holder'], categories: ['accessories'] },
      ],
    }, DEFAULT_PROFILE)

    expect(mission.context.tripType).toBeUndefined()
    expect(mission.context.occasions).toEqual(['dinner', 'formal'])
  })

  it('preserves requested quantities, per-need budgets, fragrance, and the overall total', () => {
    const mission = createSearchMission({
      rawPrompt: 'Three clothes for CAD 120 and one perfume for CAD 50, total CAD 170.',
      shoppingDepartment: 'men',
      needs: [
        { intent: 'three clothes', queries: ['summer shirt', 'relaxed trousers'], categories: ['tops', 'bottoms'], quantity: 3, budgetCad: 120 },
        { intent: 'perfume', queries: ['mens fragrance'], categories: ['fragrance'], quantity: 1, budgetCad: 50 },
      ],
      constraints: { overallBudgetCad: 170 },
    }, DEFAULT_PROFILE)
    expect(mission.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ intent: 'three clothes', quantity: 3, budgetCad: 120 }),
      expect.objectContaining({ intent: 'perfume', categories: ['fragrance'], quantity: 1, budgetCad: 50 }),
    ]))
    expect(mission.constraints.overallBudgetCad).toBe(170)
  })

  it('validates missing prompts, unsupported needs, and invalid budgets', () => {
    expect(() => createSearchMission({ rawPrompt: ' ' }, DEFAULT_PROFILE)).toThrow('rawPrompt')
    expect(() => createSearchMission({
      rawPrompt: 'trip',
      needs: [{ intent: 'day', queries: [], categories: [] }],
    }, DEFAULT_PROFILE)).toThrow('concrete retailer query')
    expect(() => createSearchMission({
      rawPrompt: 'trip',
      constraints: { maxPriceCad: -1 },
    }, DEFAULT_PROFILE)).toThrow('positive CAD')
  })

  it('extracts CAD budgets from natural language', () => {
    expect(inferMaxPriceCad('something under $180 CAD')).toBe(180)
    expect(inferMaxPriceCad('maximum CAD $95.50')).toBe(95.5)
    expect(inferMaxPriceCad('no budget supplied')).toBeUndefined()
  })
})
