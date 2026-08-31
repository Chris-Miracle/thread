import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../app/data/products'
import { productFreshnessKey } from '../app/domain/productIdentity'
import { RECOMMENDATION_REVIEW_WINDOW_MS } from '../app/domain/threadActions'
import { RESEARCH_HISTORY_STORAGE_KEY } from '../app/utils/storage'
import { candidateFromFixture, makeActions, makeStorage } from './helpers'

const fashionNovaProducts = PRODUCTS.filter(product => product.retailerId === 'fashion-nova' && product.shoppingDepartment === 'women')

function finishMission(quantity = 2) {
  const harness = makeActions()
  const started = harness.actions.startShoppingSearch({
    rawPrompt: 'Find fresh vacation dresses under CAD 140.',
    shoppingDepartment: 'women',
    needs: [{ intent: 'vacation dresses', queries: ['vacation dress'], categories: ['dresses'], quantity, budgetCad: 140 }],
    constraints: { retailerIds: ['fashion-nova'], overallBudgetCad: 140 },
  })
  const target = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
  const published = harness.actions.publishCandidates({
    searchId: started.searchId,
    targetId: target.id,
    candidates: fashionNovaProducts.slice(0, quantity).map(candidateFromFixture),
  })
  harness.actions.completeSearchTarget({
    searchId: started.searchId,
    targetId: target.id,
    status: 'complete',
    note: 'Verified product pages.',
  })
  return { harness, started, products: published.accepted }
}

describe('timed recommendation review and fresh reruns', () => {
  it('opens a two-minute review after research completes', () => {
    const { harness, started, products } = finishMission()
    const status = harness.actions.getSearchStatus(started.searchId)
    expect(status.nextAction).toBe('review_recommendations')
    expect(status.recommendationReview).toMatchObject({ status: 'pending' })
    expect(status.recommendationReview?.productIds).toEqual(expect.arrayContaining(products.map(product => product.id)))
    expect(Date.parse(status.recommendationReview!.deadlineAt) - Date.parse(status.recommendationReview!.startedAt)).toBe(RECOMMENDATION_REVIEW_WINDOW_MS)
  })

  it('accepts and saves the exact prompt plus selected products locally', () => {
    const { harness, started, products } = finishMission()
    const result = harness.actions.reviewRecommendations({ searchId: started.searchId, decision: 'accept-all' })
    expect(result).toMatchObject({ nextAction: 'research_again', review: { status: 'accepted', resolution: 'user-accepted' } })
    const history = harness.actions.getResearchHistory()
    expect(history.entries[0]).toMatchObject({
      searchId: started.searchId,
      prompt: 'Find fresh vacation dresses under CAD 140.',
      products: products.map(product => expect.objectContaining({ id: product.id })),
    })
    expect(history.seenProductKeys).toEqual(expect.arrayContaining(products.map(product => productFreshnessKey(product.url))))
    expect(harness.storage.getItem(RESEARCH_HISTORY_STORAGE_KEY)).toContain(started.searchId)
  })

  it('auto-accepts when the review deadline expires', () => {
    const { harness, started } = finishMission(1)
    const review = harness.search.value.activeSearch!.recommendationReview!
    const result = harness.actions.expireRecommendationReview(started.searchId, new Date(Date.parse(review.deadlineAt) + 1).toISOString())
    expect(result).toMatchObject({ expired: true, nextAction: 'research_again', review: { status: 'accepted', resolution: 'timeout-accepted' } })
    expect(harness.actions.getResearchHistory().entries[0]?.resolution).toBe('timeout-accepted')
  })

  it('restores a pending review after reload without losing its deadline', () => {
    const storage = makeStorage()
    const first = makeActions({ storage })
    const started = first.actions.startShoppingSearch({
      rawPrompt: 'Find one vacation dress.',
      shoppingDepartment: 'women',
      needs: [{ intent: 'vacation dress', queries: ['vacation dress'], categories: ['dresses'] }],
      constraints: { retailerIds: ['fashion-nova'] },
    })
    const target = first.actions.claimSearchTargets({ searchId: started.searchId, limit: 1 }).targets[0]!
    first.actions.publishCandidates({
      searchId: started.searchId,
      targetId: target.id,
      candidates: [candidateFromFixture(fashionNovaProducts[0]!)],
    })
    first.actions.completeSearchTarget({ searchId: started.searchId, targetId: target.id, status: 'complete' })
    const deadlineAt = first.search.value.activeSearch?.recommendationReview?.deadlineAt

    const second = makeActions({ profile: null, storage, hydrated: false })
    second.actions.hydrate()
    expect(second.search.value.activeSearch?.recommendationReview).toMatchObject({ status: 'pending', deadlineAt })
  })

  it('starts a reduced replacement mission and rejects every previously shown product family', () => {
    const { harness, started, products } = finishMission()
    const disliked = products[0]!
    const liked = products[1]!
    const reviewed = harness.actions.reviewRecommendations({
      searchId: started.searchId,
      decision: 'replace-selected',
      rejectedProductIds: [disliked.id],
    })
    expect(reviewed.replacement.mission.needs).toHaveLength(1)
    expect(reviewed.replacement.mission.needs[0]).toMatchObject({ quantity: 1, categories: ['dresses'] })
    expect(harness.actions.getResearchHistory().entries[0]?.products.map(product => product.id)).toEqual([liked.id])

    const replacementId = reviewed.replacement.searchId
    const target = harness.actions.claimSearchTargets({ searchId: replacementId, limit: 1 }).targets[0]!
    const duplicate = harness.actions.publishCandidates({
      searchId: replacementId,
      targetId: target.id,
      candidates: [candidateFromFixture(disliked)],
    })
    expect(duplicate.accepted).toEqual([])
    expect(duplicate.rejected[0]?.reason).toContain('already shown')

    const fresh = fashionNovaProducts.find(product => !products.some(previous => previous.id === product.id))!
    const accepted = harness.actions.publishCandidates({
      searchId: replacementId,
      targetId: target.id,
      candidates: [candidateFromFixture(fresh)],
    })
    expect(accepted.accepted[0]?.id).toBe(fresh.id)
  })

  it('treats colour variants of the same product page as one seen product family', () => {
    expect(productFreshnessKey('https://www.simons.ca/en/product/example--123?catId=10&colourId=1'))
      .toBe(productFreshnessKey('https://simons.ca/en/product/example--123?catId=99&colourId=41'))
  })
})
