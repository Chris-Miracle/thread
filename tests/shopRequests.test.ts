import { describe, expect, it } from 'vitest'
import { createResearchTargets } from '../app/domain/research/scheduler'
import { buildCatalogRequests, profileSizeForNeed, sizeFilterValues, targetGenderValues } from '../app/domain/research/shopRequests'
import { createSearchMission } from '../app/domain/search/mission'
import type { StyleProfile } from '../app/types/thread'
import { DEFAULT_PROFILE } from './helpers'

const SIZED_PROFILE: StyleProfile = {
  ...DEFAULT_PROFILE,
  clothingSizes: { tops: 'M', bottoms: '28' },
  shoeSize: '8',
}

function mission(input: Parameters<typeof createSearchMission>[0], profile: StyleProfile = SIZED_PROFILE) {
  return createSearchMission(input, profile, '2026-10-13T12:00:00.000Z')
}

describe('Shop catalogue request mapping', () => {
  it('maps departments to the exact Shop Target gender labels', () => {
    expect(targetGenderValues('women')).toEqual(['Female', 'Unisex'])
    expect(targetGenderValues('men')).toEqual(['Male', 'Unisex'])
    expect(targetGenderValues('all')).toBeUndefined()
  })

  it('sends merchant size synonyms and passes numeric sizes through', () => {
    expect(sizeFilterValues('m')).toEqual(['M', 'Medium'])
    expect(sizeFilterValues('XL')).toEqual(['XL', 'Extra Large'])
    expect(sizeFilterValues('28')).toEqual(['28'])
  })

  it('narrows by profile size only for a single sized category', () => {
    const built = mission({
      rawPrompt: 'Shirts and shoes',
      needs: [
        { intent: 'shirt', queries: ['linen shirt'], categories: ['tops'] },
        { intent: 'shoes', queries: ['sandals'], categories: ['footwear'] },
        { intent: 'outfit', queries: ['linen set'], categories: ['tops', 'bottoms'] },
        { intent: 'scent', queries: ['fragrance'], categories: ['fragrance'] },
      ],
    })
    const [shirt, shoes, outfit, scent] = built.needs
    expect(profileSizeForNeed(shirt!, SIZED_PROFILE)).toBe('M')
    expect(profileSizeForNeed(shoes!, SIZED_PROFILE)).toBe('8')
    expect(profileSizeForNeed(outfit!, SIZED_PROFILE)).toBeUndefined()
    expect(profileSizeForNeed(scent!, SIZED_PROFILE)).toBeUndefined()
  })

  it('builds exact search_catalog arguments with CAD minor-unit budgets', () => {
    const built = mission({
      rawPrompt: 'Find me a black shirt under $70 CAD',
      needs: [{ intent: 'black shirt', queries: ['black shirt', 'black button up', 'black blouse', 'black tee'], categories: ['tops'], budgetCad: 69.99 }],
    })
    const requests = buildCatalogRequests(built.needs[0]!, built, SIZED_PROFILE)
    expect(requests).toHaveLength(3)
    expect(requests[0]).toEqual({
      tool: 'search_catalog',
      arguments: {
        catalog: {
          query: 'black shirt',
          context: { address_country: 'CA', currency: 'CAD', intent: 'style: minimal, smart casual' },
          filters: {
            price: { max: 6999 },
            attributes: [
              { name: 'Target gender', values: ['Female', 'Unisex'] },
              { name: 'Size', values: ['M', 'Medium'] },
            ],
          },
          pagination: { limit: 10 },
        },
      },
    })
  })

  it('scopes Shop to storefront domains when the mission restricts retailers', () => {
    const built = mission({
      rawPrompt: 'Linen from Fashion Nova or Gymshark',
      shoppingDepartment: 'all',
      constraints: { retailerIds: ['fashion-nova', 'gymshark'] },
      needs: [{ intent: 'linen', queries: ['linen shirt'], categories: [] }],
    })
    const [request] = buildCatalogRequests(built.needs[0]!, built, null)
    expect(request!.arguments.catalog.filters).toEqual({ shops: ['fashionnova.com', 'ca.gymshark.com'] })
  })

  it('plans one Shop catalogue target per need ahead of retailer browsing', () => {
    const built = mission({
      rawPrompt: 'vacation in Cancun',
      needs: [
        { intent: 'resort daytime', queries: ['linen shirt'], categories: ['tops'] },
        { intent: 'beach', queries: ['swimwear'], categories: ['swimwear'] },
      ],
    })
    const targets = createResearchTargets(built, SIZED_PROFILE)
    const catalog = targets.filter(target => target.sourceType === 'catalog')
    expect(catalog.map(target => target.id)).toEqual(built.needs.map(need => `catalog:${need.id}`))
    expect(catalog.map(target => target.rank)).toEqual([1, 2])
    expect(catalog.every(target => target.searchUrls.length === 0 && target.catalogRequests?.length)).toBe(true)
  })
})
