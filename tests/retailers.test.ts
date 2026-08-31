import { describe, expect, it } from 'vitest'
import { RETAILERS, rankRetailers, retailerIdsMentionedIn } from '../app/data/retailers'
import { createSearchMission } from '../app/domain/search/mission'
import { DEFAULT_PROFILE } from './helpers'

describe('retailer adapters and ranking', () => {
  it('uses phrase boundaries and never maps the generic word shop to Shopbop', () => {
    expect(retailerIdsMentionedIn('shop for a vacation in Cancun')).not.toContain('shopbop')
    expect(retailerIdsMentionedIn('look at Shopbop and OAK + FORT')).toEqual(expect.arrayContaining(['shopbop', 'oak-fort']))
  })

  it('matches retailer names without naive substrings', () => {
    expect(retailerIdsMentionedIn('a fashion nova dress and a SHEIN top')).toEqual(['fashion-nova', 'shein'])
    expect(retailerIdsMentionedIn('fetch a new outfit')).not.toContain('farfetch')
  })

  it('ranks minimal smart-casual vacation relevance above static registry order', () => {
    const mission = createSearchMission({
      rawPrompt: 'Get my clothes for vacation in Cancun',
      stylePreferences: ['minimal', 'smart-casual'],
    }, DEFAULT_PROFILE)
    const ranked = rankRetailers(mission, DEFAULT_PROFILE)
    const topIds = ranked.slice(0, 10).map(item => item.retailer.id)
    const allIds = ranked.map(item => item.retailer.id)
    expect(topIds).toEqual(expect.arrayContaining(['cos', 'mango', 'uniqlo', 'abercrombie']))
    expect(allIds.indexOf('cos')).toBeLessThan(allIds.indexOf('fashion-nova'))
  })

  it('is independent of retailer array order', () => {
    const mission = createSearchMission({ rawPrompt: 'minimal work clothes', constraints: { categories: ['tops'] } }, DEFAULT_PROFILE)
    const forward = rankRetailers(mission, DEFAULT_PROFILE, RETAILERS).map(item => [item.retailer.id, item.score])
    const reverse = rankRetailers(mission, DEFAULT_PROFILE, [...RETAILERS].reverse()).map(item => [item.retailer.id, item.score])
    expect(reverse).toEqual(forward)
  })

  it('enforces explicit retailer restrictions and exclusions before scoring', () => {
    const profile = { ...DEFAULT_PROFILE, preferredRetailerIds: ['cos'], excludedRetailerIds: ['shein'] }
    const mission = createSearchMission({
      rawPrompt: 'vacation clothes',
      constraints: { retailerIds: ['cos', 'shein', 'mango'] },
    }, profile)
    const ids = rankRetailers(mission, profile).map(item => item.retailer.id)
    expect(ids).toEqual(['cos', 'mango'])
  })
})
