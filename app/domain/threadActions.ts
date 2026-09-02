import type { Ref } from 'vue'
import { RETAILERS } from '~/data/retailers'
import { hydrateCartState, hydrateSearchState } from '~/domain/persistence'
import { cartItemId, productFreshnessKey, stableHash } from '~/domain/productIdentity'
import {
  type ProfileInput, migrateProfile, updateProfile as mergeProfile, validateProfile,
} from '~/domain/profile/profile'
import { applyProductEnrichment, mergeCandidate, normalizeCandidate } from '~/domain/products/productValidation'
import { rankAndDiversifyProducts } from '~/domain/products/productRanking'
import { getSessionCollectionProducts, getSessionRootPrompt, getSessionRootSearchId } from '~/domain/research/collection'
import { evaluateMissionFulfillment } from '~/domain/research/fulfillment'
import { archiveReviewedSearch, cloneResearchHistory, hydrateResearchHistory, recordSeenProducts } from '~/domain/research/history'
import { claimSearchTargets as claimTargets, createResearchTargets, getSearchCoverage } from '~/domain/research/scheduler'
import { appendTrace } from '~/domain/research/telemetry'
import { createSearchMission } from '~/domain/search/mission'
import type { StorageAdapter } from '~/utils/storage'
import {
  CART_STORAGE_KEY, LEGACY_CART_STORAGE_KEYS, LEGACY_PRODUCT_STORAGE_KEYS, LEGACY_PROFILE_STORAGE_KEYS,
  LEGACY_SEARCH_STORAGE_KEYS, PROFILE_STORAGE_KEY, RESEARCH_HISTORY_STORAGE_KEY, SEARCH_STORAGE_KEY, safeParse,
} from '~/utils/storage'
import { emptySearchState } from '~/types/thread'
import type {
  ActionSource, AddToCartResult, CartState, CartSummary, GetProductsInput, Product,
  ProductCandidateInput, ProductEnrichmentInput, PublishCandidatesResult, ResearchTarget,
  RecommendationReview, RecommendationReviewResolution, ReplacementContext, SearchMissionInput, SearchSession, SearchState, StyleProfile,
} from '~/types/thread'

export { validateProfile }

export function validateStyleProfile(input: ProfileInput): StyleProfile {
  return validateProfile(input, true)
}

export function validateAgentStyleProfile(input: ProfileInput): StyleProfile {
  return validateProfile(input, false)
}

export const SEARCH_SESSION_PRODUCT_LIMIT = 600
export const RECOMMENDATION_REVIEW_WINDOW_MS = 2 * 60 * 1000

export interface ThreadActionDependencies {
  profile: Ref<StyleProfile | null>
  cart: Ref<CartState>
  search: Ref<SearchState>
  hydrated: Ref<boolean>
  storage: StorageAdapter
  fixtures?: readonly Product[]
  notify?: (message: string) => void
}

let searchSequence = 0

function cloneProduct(product: Product): Product {
  return {
    ...product,
    needIds: [...product.needIds],
    colors: [...product.colors],
    sizes: [...product.sizes],
    styleTags: [...product.styleTags],
    occasionTags: [...product.occasionTags],
  }
}

function cloneTarget(target: ResearchTarget): ResearchTarget {
  return {
    ...target,
    needIds: [...target.needIds],
    priorityReasons: [...target.priorityReasons],
    queries: [...target.queries],
    searchUrls: [...target.searchUrls],
  }
}

function cloneSession(session: SearchSession): SearchSession {
  return {
    ...session,
    mission: {
      ...session.mission,
      stylePreferences: [...session.mission.stylePreferences],
      context: {
        ...session.mission.context,
        climateHints: [...session.mission.context.climateHints],
        occasions: [...session.mission.context.occasions],
      },
      needs: session.mission.needs.map(need => ({
        ...need,
        queries: [...need.queries],
        categories: [...need.categories],
      })),
      constraints: {
        ...session.mission.constraints,
        categories: [...session.mission.constraints.categories],
        retailerIds: [...session.mission.constraints.retailerIds],
        excludedRetailerIds: [...session.mission.constraints.excludedRetailerIds],
      },
      derivedQueries: [...session.mission.derivedQueries],
    },
    targets: session.targets.map(cloneTarget),
    products: session.products.map(cloneProduct),
    rankings: session.rankings.map(ranking => ({ ...ranking })),
    fulfillment: {
      ...session.fulfillment,
      selectedProductIds: [...session.fulfillment.selectedProductIds],
      needs: session.fulfillment.needs.map(need => ({
        ...need,
        matchedProductIds: [...need.matchedProductIds],
        selectedProductIds: [...need.selectedProductIds],
      })),
    },
    telemetry: session.telemetry.map(event => ({ ...event, details: event.details ? { ...event.details } : undefined })),
    recommendationReview: session.recommendationReview
      ? {
          ...session.recommendationReview,
          productIds: [...session.recommendationReview.productIds],
          likedProductIds: [...session.recommendationReview.likedProductIds],
          rejectedProductIds: [...session.recommendationReview.rejectedProductIds],
        }
      : undefined,
    replacementContext: session.replacementContext
      ? {
          ...session.replacementContext,
          preservedProducts: session.replacementContext.preservedProducts.map(cloneProduct),
          replacedProductIds: [...session.replacementContext.replacedProductIds],
        }
      : undefined,
  }
}

function terminalTarget(target: ResearchTarget): boolean {
  return ['complete', 'no-results', 'failed', 'cancelled', 'skipped'].includes(target.status)
}

function createRecommendationReview(session: SearchSession, now: string): RecommendationReview | undefined {
  const researchedProductIds = session.fulfillment.selectedProductIds.length
    ? session.fulfillment.selectedProductIds
    : session.products.map(product => product.id)
  const productIds = session.replacementContext
    ? [
        ...session.replacementContext.preservedProducts.map(product => product.id),
        ...researchedProductIds,
      ]
    : researchedProductIds
  if (!productIds.length) return undefined
  return {
    status: 'pending',
    productIds: [...new Set(productIds)],
    likedProductIds: [],
    rejectedProductIds: [],
    startedAt: now,
    deadlineAt: new Date(Date.parse(now) + RECOMMENDATION_REVIEW_WINDOW_MS).toISOString(),
    completedAt: null,
    resolution: null,
    replacementSearchId: null,
  }
}

export function createThreadActions(deps: ThreadActionDependencies) {
  function readResearchHistory() {
    return hydrateResearchHistory(safeParse(deps.storage.getItem(RESEARCH_HISTORY_STORAGE_KEY)))
  }

  function persistResearchHistory(history: ReturnType<typeof readResearchHistory>): void {
    deps.storage.setItem(RESEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history))
  }

  function persistProfile(): void {
    if (deps.profile.value) deps.storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(deps.profile.value))
    else deps.storage.removeItem(PROFILE_STORAGE_KEY)
  }

  function persistCart(): void {
    deps.storage.setItem(CART_STORAGE_KEY, JSON.stringify(deps.cart.value))
  }

  function persistSearch(): void {
    deps.storage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(deps.search.value))
  }

  function currentSession(searchId?: string, requireActive = false): SearchSession {
    const session = searchId
      ? [deps.search.value.activeSearch, ...deps.search.value.recentSearches].find(candidate => candidate?.id === searchId) ?? null
      : deps.search.value.activeSearch
    if (!session) throw new Error('No shopping search exists. Call start_shopping_search first.')
    if (requireActive && session !== deps.search.value.activeSearch) throw new Error('This search ID belongs to a previous read-only mission.')
    if (requireActive && session.status !== 'active') throw new Error(`Search is ${session.status}; it no longer accepts research updates.`)
    return session
  }

  function commitSession(session: SearchSession, now = new Date().toISOString()): SearchSession {
    const committed = { ...session, updatedAt: now, revision: session.revision + 1 }
    deps.search.value = { ...deps.search.value, version: 4, activeSearch: committed }
    persistSearch()
    return committed
  }

  function reviewNextAction(session: SearchSession): 'review_recommendations' | 'research_again' | 'get_products' {
    if (session.recommendationReview?.status === 'pending') return 'review_recommendations'
    if (session.recommendationReview?.status === 'accepted') return 'research_again'
    return 'get_products'
  }

  function finalizeRecommendationReview(
    session: SearchSession,
    resolution: RecommendationReviewResolution,
    likedProductIds: string[],
    rejectedProductIds: string[],
    now: string,
    archive = true,
  ): SearchSession {
    if (session !== deps.search.value.activeSearch) throw new Error('Only the current mission can be reviewed.')
    const review = session.recommendationReview
    if (!review || review.status !== 'pending') throw new Error('This recommendation review is no longer pending.')
    const presented = new Set(review.productIds)
    if (![...likedProductIds, ...rejectedProductIds].every(productId => presented.has(productId))) {
      throw new Error('Review decisions must reference products presented by this mission.')
    }
    const reviewed = commitSession({
      ...session,
      recommendationReview: {
        ...review,
        status: rejectedProductIds.length ? 'replacement-started' : 'accepted',
        likedProductIds: [...new Set(likedProductIds)],
        rejectedProductIds: [...new Set(rejectedProductIds)],
        completedAt: now,
        resolution,
      },
    }, now)
    const history = readResearchHistory()
    persistResearchHistory(archive
      ? archiveReviewedSearch(history, reviewed, likedProductIds, resolution, now)
      : recordSeenProducts(history, getSessionCollectionProducts(reviewed)))
    return reviewed
  }

  function expireRecommendationReview(searchId?: string, now = new Date().toISOString()) {
    const session = currentSession(searchId)
    const review = session.recommendationReview
    if (session !== deps.search.value.activeSearch) {
      return { expired: false, searchId: session.id, review: review ? { ...review } : null, nextAction: reviewNextAction(session) }
    }
    if (!review || review.status !== 'pending') {
      return { expired: false, searchId: session.id, review: review ? { ...review } : null, nextAction: reviewNextAction(session) }
    }
    if (Date.parse(now) < Date.parse(review.deadlineAt)) {
      return { expired: false, searchId: session.id, review: { ...review }, nextAction: 'review_recommendations' as const }
    }
    const reviewed = finalizeRecommendationReview(session, 'timeout-accepted', review.productIds, [], now)
    deps.notify?.('Review time elapsed, so THREAD saved the current recommendations as accepted.')
    return { expired: true, searchId: reviewed.id, review: { ...reviewed.recommendationReview! }, nextAction: 'research_again' as const }
  }

  function hydrate(): void {
    if (deps.hydrated.value) return
    const currentProfile = migrateProfile(safeParse(deps.storage.getItem(PROFILE_STORAGE_KEY)))
    const legacyProfile = LEGACY_PROFILE_STORAGE_KEYS
      .map(key => migrateProfile(safeParse(deps.storage.getItem(key))))
      .find((profile): profile is StyleProfile => Boolean(profile))
    deps.profile.value = currentProfile ?? legacyProfile ?? null

    const currentCartValue = safeParse(deps.storage.getItem(CART_STORAGE_KEY))
    const legacyCartValue = LEGACY_CART_STORAGE_KEYS
      .map(key => safeParse(deps.storage.getItem(key)))
      .find(value => value !== null)
    deps.cart.value = hydrateCartState(currentCartValue ?? legacyCartValue)
    const currentSearchValue = safeParse(deps.storage.getItem(SEARCH_STORAGE_KEY))
    const legacySearchValue = LEGACY_SEARCH_STORAGE_KEYS
      .map(key => safeParse(deps.storage.getItem(key)))
      .find(value => value !== null)
    deps.search.value = hydrateSearchState(currentSearchValue ?? legacySearchValue)
    const hydratedSession = deps.search.value.activeSearch
    if (hydratedSession && hydratedSession.status !== 'active' && hydratedSession.products.length && !hydratedSession.recommendationReview) {
      const now = new Date().toISOString()
      deps.search.value = {
        ...deps.search.value,
        activeSearch: { ...hydratedSession, recommendationReview: createRecommendationReview(hydratedSession, now) },
      }
    }
    deps.hydrated.value = true
    persistProfile()
    persistCart()
    persistSearch()
  }

  function getProfile(): StyleProfile | null {
    const profile = deps.profile.value
    return profile
      ? {
          ...profile,
          styles: [...profile.styles],
          preferredColours: profile.preferredColours ? [...profile.preferredColours] : undefined,
          avoidedColours: profile.avoidedColours ? [...profile.avoidedColours] : undefined,
          preferredRetailerIds: profile.preferredRetailerIds ? [...profile.preferredRetailerIds] : undefined,
          excludedRetailerIds: profile.excludedRetailerIds ? [...profile.excludedRetailerIds] : undefined,
          clothingSizes: profile.clothingSizes ? { ...profile.clothingSizes } : undefined,
        }
      : null
  }

  function saveStyleProfile(input: ProfileInput, source: ActionSource = 'human'): StyleProfile {
    deps.profile.value = validateProfile({
      ...deps.profile.value,
      ...input,
      name: input.name,
      shoppingDepartment: input.shoppingDepartment ?? input.gender,
      styles: input.styles,
    }, true)
    persistProfile()
    if (source !== 'debug') deps.notify?.(`Welcome to THREAD, ${deps.profile.value.name}.`)
    return getProfile()!
  }

  function setupProfile(input: ProfileInput & { replaceExisting?: boolean }) {
    const existing = getProfile()
    if (existing && !input.replaceExisting) return { status: 'existing' as const, profile: existing }
    const profile = validateProfile({
      ...input,
      styles: input.styles ?? existing?.styles,
      shoppingDepartment: input.shoppingDepartment ?? input.gender ?? existing?.shoppingDepartment,
    }, false)
    deps.profile.value = profile
    persistProfile()
    deps.notify?.(existing ? 'Agent updated your THREAD profile.' : `Agent set up THREAD for ${profile.name}.`)
    return { status: existing ? 'updated' as const : 'created' as const, profile: getProfile()! }
  }

  function updateProfile(input: Partial<ProfileInput>): StyleProfile {
    const current = deps.profile.value
    if (!current) throw new Error('No profile exists. Call setup_profile first.')
    deps.profile.value = mergeProfile(current, input)
    persistProfile()
    deps.notify?.('Agent updated your THREAD profile.')
    return getProfile()!
  }

  function clearStyleProfile(): void {
    deps.profile.value = null
    persistProfile()
  }

  function resetWorkspace(): void {
    for (const key of [
      PROFILE_STORAGE_KEY,
      CART_STORAGE_KEY,
      SEARCH_STORAGE_KEY,
      RESEARCH_HISTORY_STORAGE_KEY,
      ...LEGACY_SEARCH_STORAGE_KEYS,
      ...LEGACY_PROFILE_STORAGE_KEYS,
      ...LEGACY_CART_STORAGE_KEYS,
      ...LEGACY_PRODUCT_STORAGE_KEYS,
    ]) deps.storage.removeItem(key)
    deps.profile.value = null
    deps.cart.value = { version: 3, items: [] }
    deps.search.value = emptySearchState()
    deps.hydrated.value = true
  }

  function startShoppingSearch(
    input: Parameters<typeof createSearchMission>[0],
    replacementContext?: ReplacementContext,
  ) {
    const existing = deps.search.value.activeSearch
    if (existing?.recommendationReview?.status === 'pending') expireRecommendationReview(existing.id)
    const previous = deps.search.value.activeSearch
    if (previous?.status === 'active') {
      throw new Error('A shopping search is already active. Complete, satisfy, cancel, or abandon it before starting another mission.')
    }
    if (previous?.recommendationReview?.status === 'pending') {
      throw new Error('Review the current recommendations before starting another mission.')
    }
    const now = new Date().toISOString()
    const mission = createSearchMission(input, deps.profile.value, now)
    searchSequence += 1
    const searchId = `search:${Date.now().toString(36)}:${searchSequence.toString(36)}:${stableHash(mission.rawPrompt)}`
    const targets = createResearchTargets(mission, deps.profile.value)
    let session: SearchSession = {
      version: 1,
      id: searchId,
      status: 'active',
      mission,
      targets,
      products: [],
      rankings: [],
      fulfillment: evaluateMissionFulfillment(mission, []),
      acceptedCandidateCount: 0,
      rejectedCandidateCount: 0,
      telemetry: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      cancellationReason: null,
      revision: 0,
      replacementContext,
    }
    session = appendTrace(session, { type: 'search_started', message: `Started “${mission.rawPrompt}”.`, at: now })
    session = appendTrace(session, { type: 'mission_created', message: `Created ${mission.needs.length} mission needs and ${mission.derivedQueries.length} concrete queries.`, at: now })
    session = appendTrace(session, { type: 'targets_ranked', message: `Ranked ${targets.filter(target => target.sourceType === 'retailer').length} eligible retailers.`, at: now })
    deps.search.value = {
      version: 4,
      activeSearch: null,
      recentSearches: previous
        ? [cloneSession(previous), ...deps.search.value.recentSearches.filter(item => item.id !== previous.id)].slice(0, 3)
        : deps.search.value.recentSearches,
    }
    session = commitSession(session, now)
    deps.notify?.(`Research started across ${targets.filter(target => target.sourceType === 'retailer').length} eligible retailers.`)
    return {
      searchId,
      mission: session.mission,
      coverage: getSearchCoverage(session),
      freshness: {
        excludedProductCount: readResearchHistory().seenProductKeys.length,
        styleCues: readResearchHistory().entries.flatMap(entry => entry.products.map(product => product.name)).slice(0, 8),
      },
      nextAction: 'claim_search_targets' as const,
    }
  }

  function claimSearchTargets(input: { searchId: string; limit?: number; workerId?: string }) {
    let session = currentSession(input.searchId, true)
    const inFlight = session.targets.filter(target => ['claimed', 'exploring'].includes(target.status))
    if (inFlight.length) {
      throw new Error(`Resolve the ${inFlight.length} claimed or exploring target${inFlight.length === 1 ? '' : 's'} before claiming another batch.`)
    }
    const now = new Date().toISOString()
    const result = claimTargets(session, input.limit ?? 3, input.workerId?.trim() || 'browser-agent', now)
    session = { ...session, targets: result.targets }
    if (result.claimed.length) {
      session = appendTrace(session, {
        type: 'targets_claimed',
        message: `Claimed ${result.claimed.length} target${result.claimed.length === 1 ? '' : 's'}.`,
        details: { count: result.claimed.length },
        at: now,
      })
      session = commitSession(session, now)
    }
    const coverage = getSearchCoverage(session)
    return {
      searchId: session.id,
      targets: result.claimed.map(cloneTarget),
      coverage,
      nextAction: result.claimed.length ? 'publish_candidates' as const : coverage.unresolvedTargets ? 'complete_search_target' as const : 'get_search_status' as const,
    }
  }

  function publishCandidates(input: {
    searchId: string
    targetId: string
    candidates: ProductCandidateInput[]
  }): PublishCandidatesResult {
    let session = currentSession(input.searchId, true)
    const target = session.targets.find(candidate => candidate.id === input.targetId)
    if (!target) throw new Error(`Search target not found: ${input.targetId}`)
    if (!['claimed', 'exploring'].includes(target.status)) throw new Error('Target must be claimed before publishing candidates.')
    if (!Array.isArray(input.candidates) || !input.candidates.length) throw new Error('Publish at least one candidate.')
    if (input.candidates.length > 40) throw new Error('Publish at most 40 candidates per batch.')
    const now = new Date().toISOString()
    if (target.status === 'claimed') {
      session = {
        ...session,
        targets: session.targets.map(candidate => candidate.id === target.id
          ? { ...candidate, status: 'exploring', updatedAt: now }
          : candidate),
      }
      session = appendTrace(session, { type: 'target_started', targetId: target.id, message: `Exploring ${target.name}.`, at: now })
    }

    const accepted: Product[] = []
    const rejected: Array<{ index: number; reason: string }> = []
    const registry = new Map(session.products.map(product => [product.id, product]))
    let newProductCount = 0
    const previouslySeen = new Set([
      ...readResearchHistory().seenProductKeys,
      ...deps.search.value.recentSearches.flatMap(previous => getSessionCollectionProducts(previous).map(product => productFreshnessKey(product.url))),
    ])
    input.candidates.forEach((candidate, index) => {
      session = appendTrace(session, { type: 'candidate_received', targetId: target.id, message: `Candidate ${index + 1} received from ${target.name}.`, at: now })
      try {
        if (typeof candidate.url === 'string' && previouslySeen.has(productFreshnessKey(candidate.url))) {
          throw new Error('Product was already shown in a previous mission. Publish a fresh product link instead.')
        }
        const normalized = normalizeCandidate(candidate, session, target, now)
        const existing = registry.get(normalized.id)
        if (!existing && registry.size >= SEARCH_SESSION_PRODUCT_LIMIT) {
          throw new Error(`Search-session candidate limit of ${SEARCH_SESSION_PRODUCT_LIMIT} reached. Complete or start a new search; no existing data was removed.`)
        }
        const product = existing ? mergeCandidate(existing, normalized) : normalized
        if (!existing) newProductCount += 1
        registry.set(product.id, product)
        accepted.push(product)
        session = appendTrace(session, { type: 'candidate_accepted', targetId: target.id, productId: product.id, message: `Accepted ${product.name} from ${product.retailer}.`, at: now })
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Invalid candidate.'
        rejected.push({ index, reason })
        session = appendTrace(session, { type: 'candidate_rejected', targetId: target.id, message: reason, details: { candidateIndex: index }, at: now })
      }
    })

    session = {
      ...session,
      products: [...registry.values()],
      acceptedCandidateCount: session.acceptedCandidateCount + accepted.length,
      rejectedCandidateCount: session.rejectedCandidateCount + rejected.length,
      targets: session.targets.map(candidate => candidate.id === target.id
        ? {
            ...candidate,
            productCount: candidate.productCount + newProductCount,
            rejectedCount: candidate.rejectedCount + rejected.length,
            updatedAt: now,
          }
        : candidate),
    }
    const ranked = rankAndDiversifyProducts(session.products, session)
    session = commitSession({
      ...session,
      products: ranked.products,
      rankings: ranked.rankings,
      fulfillment: evaluateMissionFulfillment(session.mission, ranked.products),
    }, now)
    if (accepted.length) deps.notify?.(`Agent added ${accepted.length} ${accepted.length === 1 ? 'candidate' : 'candidates'} from ${target.name}.`)
    return {
      searchId: session.id,
      accepted: accepted.map(product => cloneProduct(session.products.find(item => item.id === product.id) ?? product)),
      rejected,
      coverage: getSearchCoverage(session),
      nextAction: accepted.length ? 'publish_candidates' : 'complete_search_target',
    }
  }

  function enrichProduct(searchId: string, input: ProductEnrichmentInput): Product {
    let session = currentSession(searchId)
    if (['cancelled', 'abandoned', 'failed'].includes(session.status)) throw new Error(`Search is ${session.status}; products cannot be enriched.`)
    const current = session.products.find(product => product.id === input.productId)
    if (!current) throw new Error(`Product not found: ${input.productId}`)
    const enriched = applyProductEnrichment(current, input, session)
    const now = new Date().toISOString()
    session = {
      ...session,
      products: session.products.map(product => product.id === enriched.id ? enriched : product),
    }
    const ranked = rankAndDiversifyProducts(session.products, session)
    session = appendTrace({
      ...session,
      products: ranked.products,
      rankings: ranked.rankings,
      fulfillment: evaluateMissionFulfillment(session.mission, ranked.products),
    }, {
      type: 'product_enriched',
      targetId: enriched.targetId,
      productId: enriched.id,
      message: `Enriched ${enriched.name}.`,
      at: now,
    })
    commitSession(session, now)
    return cloneProduct(enriched)
  }

  function completeSearchTarget(input: {
    searchId: string
    targetId: string
    status: 'complete' | 'no-results' | 'failed'
    note?: string
  }) {
    let session = currentSession(input.searchId, true)
    const target = session.targets.find(candidate => candidate.id === input.targetId)
    if (!target) throw new Error(`Search target not found: ${input.targetId}`)
    if (!['claimed', 'exploring'].includes(target.status)) throw new Error('Only claimed or exploring targets may be completed.')
    const note = input.note?.trim().slice(0, 300) ?? ''
    if (input.status === 'complete' && target.productCount === 0) {
      throw new Error('A target cannot be complete with zero accepted products. Use no-results or failed.')
    }
    if ((input.status === 'no-results' || input.status === 'failed') && !note) {
      throw new Error(`${input.status} requires a short reason.`)
    }
    const now = new Date().toISOString()
    session = {
      ...session,
      targets: session.targets.map(candidate => candidate.id === target.id
        ? { ...candidate, status: input.status, note, updatedAt: now }
        : candidate),
    }
    session = appendTrace(session, {
      type: input.status === 'failed' ? 'target_failed' : 'target_completed',
      targetId: target.id,
      message: input.status === 'complete'
        ? `Completed ${target.name} with ${target.productCount} accepted product${target.productCount === 1 ? '' : 's'}.`
        : `${target.name}: ${input.status}. ${note}`,
      at: now,
    })
    session = { ...session, fulfillment: evaluateMissionFulfillment(session.mission, session.products) }
    const inFlight = session.targets.some(candidate => ['claimed', 'exploring'].includes(candidate.status))
    const queued = session.targets.some(candidate => candidate.status === 'queued')
    if (session.fulfillment.satisfied && !inFlight && queued) {
      session = {
        ...session,
        status: 'satisfied',
        completedAt: now,
        targets: session.targets.map(candidate => candidate.status === 'queued'
          ? {
              ...candidate,
              status: 'skipped',
              note: 'Skipped after every required mission need was satisfied within budget.',
              updatedAt: now,
            }
          : candidate),
      }
      session = appendTrace(session, {
        type: 'search_satisfied',
        message: `Required needs satisfied at CAD ${session.fulfillment.subtotalCad.toFixed(2)}; unneeded queued targets were preserved as skipped.`,
        details: {
          subtotalCad: session.fulfillment.subtotalCad,
          selectedProducts: session.fulfillment.selectedProductIds.length,
        },
        at: now,
      })
      deps.notify?.('Your requested basket is satisfied within budget. Remaining queued retailers were marked skipped.')
    } else if (session.targets.every(terminalTarget)) {
      session = { ...session, status: 'completed', completedAt: now }
      session = appendTrace(session, { type: 'search_completed', message: 'All planned research targets are resolved.', at: now })
      deps.notify?.('Retailer research is complete.')
    }
    if (session.status !== 'active' && !session.recommendationReview) {
      session = { ...session, recommendationReview: createRecommendationReview(session, now) }
      if (session.recommendationReview) {
        deps.notify?.('Research is complete. Review the recommendations before THREAD saves them.')
      }
    }
    session = commitSession(session, now)
    const coverage = getSearchCoverage(session)
    return {
      searchId: session.id,
      target: cloneTarget(session.targets.find(candidate => candidate.id === target.id)!),
      coverage,
      searchStatus: session.status,
      fulfillment: session.fulfillment,
      nextAction: session.status !== 'active' ? reviewNextAction(session) : coverage.queuedTargets ? 'claim_search_targets' as const : 'complete_search_target' as const,
    }
  }

  function replacementMissionInput(session: SearchSession, productIds: readonly string[]): SearchMissionInput {
    const requested = new Set(productIds)
    const collection = getSessionCollectionProducts(session)
    const rejectedProducts = collection.filter(product => requested.has(product.id))
    if (!rejectedProducts.length) throw new Error('Choose at least one presented product to replace.')
    const coveredProductIds = new Set<string>()
    const replacementNeeds = session.mission.needs.flatMap((need) => {
      const selectedForNeed = session.fulfillment.needs.find(item => item.needId === need.id)?.selectedProductIds ?? []
      const matchingProducts = rejectedProducts.filter(product => product.needIds.includes(need.id))
      const quantity = selectedForNeed.filter(productId => requested.has(productId)).length || matchingProducts.length
      if (!quantity) return []
      matchingProducts.forEach(product => coveredProductIds.add(product.id))
      const productNames = matchingProducts.map(product => product.name)
      return [{
        intent: `replacement for ${need.intent.replace(/^fresh alternatives? for /i, '')}`,
        queries: [...new Set([
          ...need.queries.map(query => /alternative/i.test(query) ? query : `${query} alternative`),
          ...productNames.map(name => `alternative to ${name}`),
        ])].slice(0, 10),
        categories: [...need.categories],
        required: need.required,
        quantity,
        budgetCad: need.budgetCad,
      }]
    })
    replacementNeeds.push(...rejectedProducts
      .filter(product => !coveredProductIds.has(product.id))
      .map(product => ({
        intent: `fresh alternative for ${product.name}`,
        queries: [`alternative to ${product.name}`],
        categories: product.category ? [product.category] : [],
        required: true,
        quantity: 1,
        budgetCad: product.priceCad,
      })))
    const likedNames = session.recommendationReview?.likedProductIds
      .map(productId => collection.find(product => product.id === productId)?.name)
      .filter((name): name is string => Boolean(name)) ?? []
    const cue = likedNames.length ? ` Use the accepted pieces as style cues: ${likedNames.join(', ')}.` : ''
    return {
      rawPrompt: `Replace ${rejectedProducts.map(product => product.name).join(', ')}. Keep every other accepted item. Original brief: ${getSessionRootPrompt(session)}`,
      shoppingDepartment: session.mission.shoppingDepartment,
      stylePreferences: [...session.mission.stylePreferences],
      context: {
        ...session.mission.context,
        climateHints: [...session.mission.context.climateHints],
        occasions: [...session.mission.context.occasions],
        notes: `${session.mission.context.notes ?? ''}${cue} Do not repeat products shown in earlier missions.`.trim().slice(0, 300),
      },
      needs: replacementNeeds,
      constraints: {
        ...session.mission.constraints,
        categories: [...new Set(replacementNeeds.flatMap(need => need.categories))],
        retailerIds: [...session.mission.constraints.retailerIds],
        excludedRetailerIds: [...session.mission.constraints.excludedRetailerIds],
      },
    }
  }

  function createReplacementContext(session: SearchSession, productIds: readonly string[]): ReplacementContext {
    const requested = new Set(productIds)
    const collection = getSessionCollectionProducts(session)
    return {
      rootSearchId: getSessionRootSearchId(session),
      rootPrompt: getSessionRootPrompt(session),
      sourceSearchId: session.id,
      preservedProducts: collection.filter(product => !requested.has(product.id)).map(cloneProduct),
      replacedProductIds: [...requested],
    }
  }

  function reviewRecommendations(input: {
    searchId: string
    decision: 'accept-all' | 'replace-selected' | 'replace-all'
    rejectedProductIds?: string[]
  }) {
    let session = currentSession(input.searchId)
    if (session !== deps.search.value.activeSearch) throw new Error('Only the current mission can be reviewed.')
    expireRecommendationReview(session.id)
    session = currentSession(input.searchId)
    const review = session.recommendationReview
    if (!review || review.status !== 'pending') throw new Error('This recommendation review is no longer pending.')
    if (input.decision === 'accept-all') {
      const reviewed = finalizeRecommendationReview(session, 'user-accepted', review.productIds, [], new Date().toISOString())
      deps.notify?.('Recommendations accepted and saved locally.')
      return { searchId: reviewed.id, review: { ...reviewed.recommendationReview! }, nextAction: 'research_again' as const }
    }
    const rejectedProductIds = input.decision === 'replace-all'
      ? [...review.productIds]
      : [...new Set(input.rejectedProductIds ?? [])]
    if (!rejectedProductIds.length) throw new Error('Choose at least one product to replace.')
    if (!rejectedProductIds.every(productId => review.productIds.includes(productId))) {
      throw new Error('Replacement product IDs must come from the presented recommendations.')
    }
    const rejected = new Set(rejectedProductIds)
    const likedProductIds = review.productIds.filter(productId => !rejected.has(productId))
    const resolution = input.decision === 'replace-all' ? 'replace-all' : 'replace-selected'
    const reviewed = finalizeRecommendationReview(session, resolution, likedProductIds, rejectedProductIds, new Date().toISOString(), false)
    const replacement = startShoppingSearch(
      replacementMissionInput(reviewed, rejectedProductIds),
      createReplacementContext(reviewed, rejectedProductIds),
    )
    const archivedSource = deps.search.value.recentSearches.find(candidate => candidate.id === reviewed.id)
    if (archivedSource?.recommendationReview) {
      deps.search.value = {
        ...deps.search.value,
        recentSearches: deps.search.value.recentSearches.map(candidate => candidate.id === reviewed.id
          ? {
              ...candidate,
              recommendationReview: { ...candidate.recommendationReview!, replacementSearchId: replacement.searchId },
            }
          : candidate),
      }
      persistSearch()
    }
    deps.notify?.(`Fresh research started for ${rejectedProductIds.length} replacement${rejectedProductIds.length === 1 ? '' : 's'}.`)
    return { searchId: reviewed.id, review: { ...reviewed.recommendationReview!, replacementSearchId: replacement.searchId }, replacement, nextAction: 'claim_search_targets' as const }
  }

  function researchAgain(input: { searchId: string; productIds?: string[] }) {
    const session = currentSession(input.searchId)
    if (session.recommendationReview?.status === 'pending') {
      throw new Error('Review the current recommendations before researching again.')
    }
    if (deps.search.value.activeSearch?.status === 'active') throw new Error('Finish the active mission before researching again.')
    const productIds = input.productIds?.length
      ? [...new Set(input.productIds)]
      : session.recommendationReview?.productIds ?? session.fulfillment.selectedProductIds
    const replacement = startShoppingSearch(
      replacementMissionInput(session, productIds),
      createReplacementContext(session, productIds),
    )
    return { sourceSearchId: session.id, replacement, nextAction: 'claim_search_targets' as const }
  }

  function getResearchHistory() {
    const history = cloneResearchHistory(readResearchHistory())
    return {
      ...history,
      seenProductCount: history.seenProductKeys.length,
      styleCues: history.entries.flatMap(entry => entry.products.map(product => product.name)).slice(0, 12),
    }
  }

  function cancelSearch(
    searchId: string,
    reason = 'Stopped by the user.',
    disposition: 'cancelled' | 'abandoned' = 'cancelled',
  ): ReturnType<typeof getSearchStatus> {
    let session = currentSession(searchId, true)
    const now = new Date().toISOString()
    session = {
      ...session,
      status: disposition,
      cancellationReason: reason.trim().slice(0, 300) || 'Stopped by the user.',
      completedAt: now,
      targets: session.targets.map(target => terminalTarget(target)
        ? target
        : { ...target, status: 'cancelled', note: 'Search cancelled before this target resolved.', updatedAt: now }),
    }
    session = appendTrace(session, { type: 'search_cancelled', message: session.cancellationReason!, at: now })
    commitSession(session, now)
    deps.notify?.(disposition === 'abandoned' ? 'Research abandoned. Existing candidates remain available.' : 'Research stopped. Existing candidates remain available.')
    return getSearchStatus(searchId)
  }

  function getSearchStatus(searchId?: string) {
    expireRecommendationReview(searchId)
    const session = currentSession(searchId)
    const collectionProducts = getSessionCollectionProducts(session)
    return {
      searchId: session.id,
      status: session.status,
      mission: cloneSession(session).mission,
      fulfillment: cloneSession(session).fulfillment,
      coverage: getSearchCoverage(session),
      targets: session.targets.map(cloneTarget),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      cancellationReason: session.cancellationReason,
      recommendationReview: cloneSession(session).recommendationReview ?? null,
      collection: {
        rootSearchId: getSessionRootSearchId(session),
        rootPrompt: getSessionRootPrompt(session),
        productIds: collectionProducts.map(product => product.id),
        preservedProductIds: session.replacementContext?.preservedProducts.map(product => product.id) ?? [],
        replacingProductIds: [...(session.replacementContext?.replacedProductIds ?? [])],
      },
      nextAction: session.status !== 'active'
        ? reviewNextAction(session)
        : session.targets.some(target => target.status === 'queued')
          ? 'claim_search_targets'
          : 'complete_search_target',
    }
  }

  function getProducts(input: GetProductsInput = {}) {
    const session = currentSession(input.searchId)
    const limit = input.limit ?? 24
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be between 1 and 100.')
    const cursorOffset = input.cursor?.match(/^offset:(\d+)$/)?.[1]
    const offset = cursorOffset ? Number(cursorOffset) : input.offset ?? 0
    if (!Number.isInteger(offset) || offset < 0) throw new Error('offset must be a non-negative integer.')
    let products = getSessionCollectionProducts(session)
      .filter(product => !input.retailerId || product.retailerId === input.retailerId)
      .filter(product => !input.category || product.category === input.category)
    if (input.sort === 'price-asc') products = products.toSorted((left, right) => (left.priceCad ?? Number.POSITIVE_INFINITY) - (right.priceCad ?? Number.POSITIVE_INFINITY))
    if (input.sort === 'price-desc') products = products.toSorted((left, right) => (right.priceCad ?? Number.NEGATIVE_INFINITY) - (left.priceCad ?? Number.NEGATIVE_INFINITY))
    if (input.sort === 'newest') products = products.toSorted((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
    const page = products.slice(offset, offset + limit)
    const nextOffset = offset + page.length
    return {
      searchId: session.id,
      total: products.length,
      offset,
      limit,
      nextCursor: nextOffset < products.length ? `offset:${nextOffset}` : null,
      products: page.map(cloneProduct),
    }
  }

  function getProductById(productId: string): Product | undefined {
    const sessionProduct = deps.search.value.activeSearch
      ? getSessionCollectionProducts(deps.search.value.activeSearch).find(product => product.id === productId)
      : undefined
    const recentProduct = deps.search.value.recentSearches
      .flatMap(getSessionCollectionProducts)
      .find(product => product.id === productId)
    const savedProduct = readResearchHistory().entries
      .flatMap(entry => entry.products)
      .find(product => product.id === productId)
    const fixture = deps.fixtures?.find(product => product.id === productId)
    const cartProduct = deps.cart.value.items.find(item => item.productId === productId)?.product
    const product = sessionProduct ?? recentProduct ?? savedProduct ?? fixture ?? cartProduct
    return product ? cloneProduct(product) : undefined
  }

  function addToCart(productId: string, options: { size?: string; color?: string } = {}, source: ActionSource = 'human'): AddToCartResult {
    const product = getProductById(productId)
    if (!product) throw new Error(`Product not found: ${productId}`)
    if (product.availability === 'out-of-stock') throw new Error(`${product.name} is marked out of stock.`)
    if (product.stage !== 'enriched') throw new Error('This candidate needs product enrichment before it can be added. Open the retailer page to verify variants.')
    if (product.sizes.length && !options.size) throw new Error(`Select a size for ${product.name}.`)
    if (product.colors.length && !options.color) throw new Error(`Select a colour for ${product.name}.`)
    if (options.size && !product.sizes.includes(options.size)) throw new Error(`${options.size} is not an available size for ${product.name}.`)
    if (options.color && !product.colors.includes(options.color)) throw new Error(`${options.color} is not an available colour for ${product.name}.`)
    const id = cartItemId(product.id, options.size, options.color)
    const existing = deps.cart.value.items.find(item => item.id === id)
    if (existing) {
      const summary = getCart()
      return { success: true, duplicate: true, item: { ...existing, product: cloneProduct(existing.product) }, cartCount: summary.itemCount, totals: summary.totals }
    }
    const item = { id, productId: product.id, product, size: options.size, color: options.color, addedAt: new Date().toISOString() }
    deps.cart.value = { version: 3, items: [...deps.cart.value.items, item] }
    persistCart()
    if (source === 'agent') deps.notify?.(`Agent added ${product.name} to your THREAD.`)
    else if (source === 'human') deps.notify?.(`${product.name} added to your THREAD.`)
    const summary = getCart()
    return { success: true, duplicate: false, item: { ...item, product: cloneProduct(product) }, cartCount: summary.itemCount, totals: summary.totals }
  }

  function removeFromCart(itemId: string, source: ActionSource = 'human'): boolean {
    const item = deps.cart.value.items.find(candidate => candidate.id === itemId)
    if (!item) return false
    deps.cart.value = { version: 3, items: deps.cart.value.items.filter(candidate => candidate.id !== itemId) }
    persistCart()
    if (source === 'agent') deps.notify?.(`Agent removed ${item.product.name} from your THREAD.`)
    return true
  }

  function clearCart(): void {
    deps.cart.value = { version: 3, items: [] }
    persistCart()
  }

  function getCart(): CartSummary {
    const items = deps.cart.value.items.map(item => ({ ...item, product: cloneProduct(item.product) }))
    const subtotal = items.reduce((sum, item) => sum + (item.product.priceCad ?? 0), 0)
    return {
      items,
      itemCount: items.length,
      totals: subtotal > 0 ? [{ currency: 'CAD', subtotal: Number(subtotal.toFixed(2)) }] : [],
      unpricedItemCount: items.filter(item => item.product.priceCad === undefined).length,
    }
  }

  function getVisibleProducts(): Product[] {
    return deps.search.value.activeSearch?.products.map(cloneProduct) ?? []
  }

  function getRetailers() {
    return RETAILERS.map(retailer => ({
      ...retailer,
      domains: [...retailer.domains],
      departments: [...retailer.departments],
      tags: [...retailer.tags],
      aliases: [...retailer.aliases],
      capabilities: {
        ...retailer.capabilities,
        categories: [...retailer.capabilities.categories],
        styles: [...retailer.capabilities.styles],
        occasions: [...retailer.capabilities.occasions],
      },
    }))
  }

  function getExecutionTrace() {
    return deps.search.value.activeSearch?.telemetry.map(event => ({ ...event, details: event.details ? { ...event.details } : undefined })) ?? []
  }

  return {
    hydrate,
    getProfile,
    getStyleProfile: getProfile,
    saveStyleProfile,
    setupProfile,
    updateProfile,
    clearStyleProfile,
    resetWorkspace,
    startShoppingSearch,
    claimSearchTargets,
    publishCandidates,
    enrichProduct,
    completeSearchTarget,
    cancelSearch,
    getSearchStatus,
    getProducts,
    reviewRecommendations,
    expireRecommendationReview,
    researchAgain,
    getResearchHistory,
    getProductById,
    getVisibleProducts,
    getRetailers,
    getExecutionTrace,
    addToCart,
    removeFromCart,
    clearCart,
    getCart,
  }
}
