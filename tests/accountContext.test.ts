import { describe, expect, it } from 'vitest'
import { buildCatalogRequests } from '../app/domain/research/shopRequests'
import { createSearchMission } from '../app/domain/search/mission'
import { createThreadToolDefinitions } from '../app/webmcp/registerThreadTools'
import { DEFAULT_PROFILE, makeActions } from './helpers'

const SHIRT_URL = 'https://www.fashionnova.com/products/on-your-mind-linen-shirt-fncolorname-white'

describe('profile destination for Shop context', () => {
  it('uses the saved country and region, keeping CAD as the comparison currency', () => {
    const profile = { ...DEFAULT_PROFILE, destination: { country: 'US', region: 'NY' } }
    const mission = createSearchMission({ rawPrompt: 'linen shirt', needs: [{ intent: 'shirt', queries: ['linen shirt'] }] }, profile, '2026-10-13T12:00:00.000Z')
    const [request] = buildCatalogRequests(mission.needs[0]!, mission, profile)
    expect(request!.arguments.catalog.context).toEqual({ address_country: 'US', address_region: 'NY', currency: 'CAD', intent: 'style: minimal, smart casual' })
  })

  it('validates the destination and keeps omitted fields on agent updates', async () => {
    const harness = makeActions({ profile: { ...DEFAULT_PROFILE, shoeSize: '8', usualBudgetCad: 120 } })
    expect(() => harness.actions.updateProfile({ destination: { country: 'Canada' } })).toThrow('two-letter code')
    const update = createThreadToolDefinitions(harness.actions).find(tool => tool.name === 'update_profile')!
    const result = await update.execute({ destination: { country: 'ca', region: 'ON' } }) as { profile: Record<string, unknown> }
    expect(result.profile).toMatchObject({ destination: { country: 'CA', region: 'ON' }, shoeSize: '8', usualBudgetCad: 120 })
  })
})

describe('purchase signals', () => {
  it('never recommends a purchased product again and keeps brands as cues', () => {
    const harness = makeActions()
    const recorded = harness.actions.recordPurchases({
      source: 'order-history',
      purchases: [{ productUrl: `${SHIRT_URL}?variant=1&_gsid=x&utm_source=shopify`, brand: 'Fashion Nova' }],
    })
    expect(recorded).toMatchObject({ recorded: 1, rejected: [], markedOrdered: [], purchasedBrands: ['Fashion Nova'] })
    const started = harness.actions.startShoppingSearch({
      rawPrompt: 'Linen shirt from Fashion Nova',
      constraints: { retailerIds: ['fashion-nova'] },
      needs: [{ intent: 'shirt', queries: ['linen shirt'], categories: ['tops'] }],
    })
    expect(started.freshness.purchasedBrands).toEqual(['Fashion Nova'])
    const catalog = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    const result = harness.actions.publishCandidates({
      searchId: started.searchId,
      targetId: catalog.id,
      candidates: [{ url: `${SHIRT_URL}?variant=2&_gsid=y`, name: 'On Your Mind Linen Shirt', image: 'https://cdn.shopify.com/s/files/shirt.jpg', category: 'tops', shoppingDepartment: 'women', shop: { productId: 'gid://shopify/p/1', sellerDomain: 'fnova.myshopify.com' } }],
    })
    expect(result.rejected[0]?.reason).toContain('already shown')
  })

  it('requires the seller for checkout reports and rejects unsafe links without dropping valid ones', () => {
    const { actions } = makeActions()
    const result = actions.recordPurchases({
      source: 'checkout',
      purchases: [
        { productUrl: SHIRT_URL },
        { sellerDomain: 'fnova.myshopify.com', orderPermalink: 'http://example.test/order' },
        { sellerDomain: 'fnova.myshopify.com', brand: 'Fashion Nova' },
      ],
    })
    expect(result.recorded).toBe(1)
    expect(result.rejected.map(item => item.reason)).toEqual([
      expect.stringContaining('sellerDomain is required'),
      expect.stringContaining('HTTPS'),
    ])
  })
})
