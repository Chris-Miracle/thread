import { storeDomain } from '~/domain/search/stores'
import { ref, type Ref } from 'vue'
import { RETAILERS } from '~/data/retailers'
import { SIZED_PRODUCT_CATEGORIES, hasRequiredShopOptions, isColorOption, isSizeOption, buildCheckoutGroups, groupCartItems, groupItemsHash, matchVariant, pruneMerchantCarts } from '~/domain/cart/checkoutPlan'
import { hydrateCartState, hydrateInspirationState, hydrateSearchState } from '~/domain/persistence'
import { cartItemId, productFreshnessKey, stableHash } from '~/domain/productIdentity'
import {
  type ProfileInput, migrateProfile, updateProfile as mergeProfile, validateProfile,
} from '~/domain/profile/profile'
import { fromMinorUnits, applyProductEnrichment, mergeCandidate, normalizeCandidate } from '~/domain/products/productValidation'
import { rankAndDiversifyProducts } from '~/domain/products/productRanking'
import { getProductVariantPolicy, resolveCartVariant } from '~/domain/products/productVariants'
import { getSessionCollectionProducts, getSessionRootPrompt, getSessionRootSearchId } from '~/domain/research/collection'
import { evaluateMissionFulfillment } from '~/domain/research/fulfillment'
import {
  archiveReviewedSearch, cloneResearchHistory, hydrateResearchHistory, recordPurchaseSignals, recordSeenProducts,
} from '~/domain/research/history'
import {
  MAX_SIMILARITY_TARGETS, claimSearchTargets as claimTargets, createResearchTargets, createSimilarityTarget, getSearchCoverage, similarityTargetId,
} from '~/domain/research/scheduler'
import { nextSteps, type AgentStep } from '~/domain/research/runbook'
import { buildSimilarityRequests, imageLikeEntry, matchesSavedSize } from '~/domain/research/shopRequests'
import { appendTrace } from '~/domain/research/telemetry'
import { MAX_MISSION_SEEDS, createSearchMission } from '~/domain/search/mission'
import type { StorageAdapter } from '~/utils/storage'
import {
  CART_STORAGE_KEY, INSPIRATION_STORAGE_KEY, LEGACY_CART_STORAGE_KEYS, LEGACY_PRODUCT_STORAGE_KEYS, LEGACY_PROFILE_STORAGE_KEYS,
  LEGACY_SEARCH_STORAGE_KEYS, PROFILE_STORAGE_KEY, RESEARCH_HISTORY_STORAGE_KEY, SEARCH_STORAGE_KEY, safeParse,
} from '~/utils/storage'
import { emptyCartState, emptyInspirationState, emptySearchState } from '~/types/thread'
import type {
  ActionSource, AddToCartResult, CartState, CartSummary, GetProductsInput, InspirationItem, InspirationSource, InspirationState,
  MerchantCart, Product, ProductCategory, SimilaritySeed, VisualGuide, CartSelection,
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
export const MAX_INSPIRATION_ITEMS = 8
// Uploads are downscaled before storage; this bounds one stored image to roughly 150 KB.
const MAX_INSPIRATION_DATA_URL_LENGTH = 200_000
const PINTEREST_HOST = /(^|\.)pinterest\.[a-z.]+$|^pin\.it$/i

export interface ThreadActionDependencies {
  profile: Ref<StyleProfile | null>
  cart: Ref<CartState>
  search: Ref<SearchState>
  inspiration?: Ref<InspirationState>
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
    commerce: product.commerce
      ? { ...product.commerce, selectedOptions: product.commerce.selectedOptions.map(option => ({ ...option })) }
      : undefined,
    variants: product.variants?.map(variant => ({ ...variant, options: variant.options.map(option => ({ ...option })) })),
  }
}

function cloneTarget(target: ResearchTarget): ResearchTarget {
  return {
    ...target,
    needIds: [...target.needIds],
    priorityReasons: [...target.priorityReasons],
    queries: [...target.queries],
    searchUrls: [...target.searchUrls],
    catalogRequests: target.catalogRequests ? JSON.parse(JSON.stringify(target.catalogRequests)) : undefined,
    seed: target.seed ? { ...target.seed } : undefined,
  }
}

function cloneRecommendationReview(review: RecommendationReview): RecommendationReview {
  return {
    ...review,
    productIds: [...review.productIds],
    likedProductIds: [...review.likedProductIds],
    rejectedProductIds: [...review.rejectedProductIds],
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
        ...(need.retailerIds ? { retailerIds: [...need.retailerIds] } : {}),
        ...(need.storeDomains ? { storeDomains: [...need.storeDomains] } : {}),
        ...(need.storeNames ? { storeNames: [...need.storeNames] } : {}),
      })),
      constraints: {
        ...session.mission.constraints,
        categories: [...session.mission.constraints.categories],
        retailerIds: [...session.mission.constraints.retailerIds],
        excludedRetailerIds: [...session.mission.constraints.excludedRetailerIds],
        storeDomains: [...(session.mission.constraints.storeDomains ?? [])],
        storeNames: [...(session.mission.constraints.storeNames ?? [])],
      },
      derivedQueries: [...session.mission.derivedQueries],
      seeds: session.mission.seeds?.map(seed => ({ ...seed })),
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
      ? cloneRecommendationReview(session.recommendationReview)
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
  const inspiration = deps.inspiration ?? ref<InspirationState>(emptyInspirationState())

  /** Runbook steps for the agent, detached from reactive state so they serialize across WebMCP. */
  function agentNext(session: SearchSession | null, claimed?: readonly ResearchTarget[]): AgentStep[] {
    return JSON.parse(JSON.stringify(nextSteps(session, claimed)))
  }

  function persistInspiration(): void {
    deps.storage.setItem(INSPIRATION_STORAGE_KEY, JSON.stringify(inspiration.value))
  }

  /** Upload seeds keep their bytes in the inspiration store; claimed targets receive ready `like` requests. */
  function withSeedImage(target: ResearchTarget, session: SearchSession): ResearchTarget {
    const seed = target.seed
    if (seed?.kind !== 'image' || seed.source !== 'upload') return target
    const item = inspiration.value.items.find(candidate => candidate.id === seed.inspirationId)
    const need = session.mission.needs.find(candidate => target.needIds.includes(candidate.id)) ?? session.mission.needs[0]
    if (!item?.imageData || !need) return target
    return { ...target, catalogRequests: buildSimilarityRequests(seed, need, session.mission, deps.profile.value, item.imageData) }
  }
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
      return { expired: false, searchId: session.id, review: review ? cloneRecommendationReview(review) : null, nextAction: reviewNextAction(session) }
    }
    if (!review || review.status !== 'pending') {
      return { expired: false, searchId: session.id, review: review ? cloneRecommendationReview(review) : null, nextAction: reviewNextAction(session) }
    }
    if (Date.parse(now) < Date.parse(review.deadlineAt)) {
      return { expired: false, searchId: session.id, review: cloneRecommendationReview(review), nextAction: 'review_recommendations' as const }
    }
    const reviewed = finalizeRecommendationReview(session, 'timeout-accepted', review.productIds, [], now)
    deps.notify?.('Review time elapsed, so Rove saved the current recommendations as accepted.')
    return { expired: true, searchId: reviewed.id, review: cloneRecommendationReview(reviewed.recommendationReview!), nextAction: 'research_again' as const }
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
    inspiration.value = hydrateInspirationState(safeParse(deps.storage.getItem(INSPIRATION_STORAGE_KEY)))
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
    if (source !== 'debug') deps.notify?.(`Welcome to Rove, ${deps.profile.value.name}.`)
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
    deps.notify?.(existing ? 'Agent updated your Rove profile.' : `Agent set up Rove for ${profile.name}.`)
    return { status: existing ? 'updated' as const : 'created' as const, profile: getProfile()! }
  }

  function updateProfile(input: Partial<ProfileInput>): StyleProfile {
    const current = deps.profile.value
    if (!current) throw new Error('No profile exists. Call setup_profile first.')
    deps.profile.value = mergeProfile(current, input)
    persistProfile()
    deps.notify?.('Agent updated your Rove profile.')
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
      INSPIRATION_STORAGE_KEY,
      ...LEGACY_SEARCH_STORAGE_KEYS,
      ...LEGACY_PROFILE_STORAGE_KEYS,
      ...LEGACY_CART_STORAGE_KEYS,
      ...LEGACY_PRODUCT_STORAGE_KEYS,
    ]) deps.storage.removeItem(key)
    deps.profile.value = null
    deps.cart.value = emptyCartState()
    deps.search.value = emptySearchState()
    inspiration.value = emptyInspirationState()
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
        purchasedBrands: readResearchHistory().purchasedBrands.slice(-12),
      },
      nextAction: 'claim_search_targets' as const,
      next: agentNext(session),
    }
  }

  function resolveStore(input: { searchId: string; name: string; domain: string }) {
    let session = currentSession(input.searchId, true)
    const names = session.mission.constraints.storeNames ?? []
    if (!names.includes(input.name)) throw new Error('This store is not awaiting resolution.')
    if (session.products.length || session.targets.some(target => target.status !== 'queued')) throw new Error('Resolve named stores before claiming research targets.')
    const domain = storeDomain(input.domain)
    const mission = { ...session.mission, needs: session.mission.needs.map(need => need.storeNames?.includes(input.name)
      ? { ...need, storeNames: need.storeNames.filter(name => name !== input.name), storeDomains: [...new Set([...(need.storeDomains ?? []), domain])] } : need), constraints: { ...session.mission.constraints,
      storeNames: names.filter(name => name !== input.name), storeDomains: [...new Set([...(session.mission.constraints.storeDomains ?? []), domain])] } }
    session = commitSession({ ...session, mission, targets: createResearchTargets(mission, deps.profile.value) })
    return { searchId: session.id, mission: cloneSession(session).mission, next: agentNext(session) }
  }

  function claimSearchTargets(input: { searchId: string; limit?: number; workerId?: string }) {
    let session = currentSession(input.searchId, true)
    if (session.mission.constraints.storeNames?.length) throw new Error('Resolve the requested stores to verified official domains before claiming targets.')
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
    const claimed = result.claimed.map(target => withSeedImage(cloneTarget(target), session))
    return {
      searchId: session.id,
      targets: claimed,
      coverage,
      nextAction: result.claimed.length ? 'publish_candidates' as const : coverage.unresolvedTargets ? 'complete_search_target' as const : 'get_search_status' as const,
      next: agentNext(session, claimed),
    }
  }

  function getShopRequest(searchId: string, targetId: string, requestIndex = 0) {
    const session = currentSession(searchId, true)
    const target = session.targets.find(target => target.id === targetId)
    if (target?.sourceType !== 'catalog' || !['claimed', 'exploring'].includes(target.status)) throw new Error('Claim an active Shop catalogue target before searching.')
    if (!Number.isInteger(requestIndex) || requestIndex < 0) throw new Error('requestIndex must be a non-negative integer.')
    const requests = withSeedImage(cloneTarget(target), session).catalogRequests ?? []
    const request = requests[requestIndex]
    if (!request) throw new Error('No planned Shop request exists at this index.')
    return { request, requestCount: requests.length }
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
    const rejected: PublishCandidatesResult['rejected'] = []
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
        rejected.push({ index, ...(typeof candidate.name === 'string' ? { name: candidate.name.slice(0, 120) } : {}), reason })
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
    // A stopped mission stays read-only, except for pieces the person kept: verifying them is how they reach the Thread.
    const review = session.recommendationReview
    const kept = Boolean(review && review.status !== 'pending' && review.likedProductIds.includes(input.productId))
    if (['cancelled', 'abandoned', 'failed'].includes(session.status) && !kept) throw new Error(`Search is ${session.status}; only products kept in its review can be enriched.`)
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
    // Saved edits share enriched evidence, rather than retaining stale candidate snapshots.
    const history = readResearchHistory()
    persistResearchHistory({ ...history, entries: history.entries.map(entry => ({ ...entry, products: entry.products.map(product => product.id === enriched.id ? cloneProduct(enriched) : product) })) })
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
    const pinnedCount = inspiration.value.items.filter(item => item.targetId === target.id).length
    if (input.status === 'complete' && target.productCount === 0 && !pinnedCount) {
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
    // Similarity searches the person asked for are never skipped by early satisfaction, and research only stops
    // early once every required need had real alternatives to choose from.
    const requestedPending = session.targets.some(candidate => candidate.seed && candidate.status === 'queued')
    if (session.fulfillment.ready && !inFlight && queued && !requestedPending) {
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
        deps.notify?.('Research is complete. Review the recommendations before Rove saves them.')
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
      next: agentNext(session),
    }
  }

  function replacementMissionInput(session: SearchSession, productIds: readonly string[]): SearchMissionInput {
    const requested = new Set(productIds)
    const collection = getSessionCollectionProducts(session)
    const rejectedProducts = collection.filter(product => requested.has(product.id))
    if (!rejectedProducts.length) throw new Error('Choose at least one presented product to replace.')
    const coveredProductIds = new Set<string>()
    const replacementNeeds: NonNullable<SearchMissionInput['needs']> = session.mission.needs.flatMap((need) => {
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
        retailerIds: need.retailerIds ? [...need.retailerIds] : undefined,
        storeDomains: need.storeDomains ? [...need.storeDomains] : undefined,
        storeNames: need.storeNames ? [...need.storeNames] : undefined,
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
    // Liked Shop products seed visual similarity searches for their replacements.
    const seeds = (session.recommendationReview?.likedProductIds ?? [])
      .map(productId => collection.find(product => product.id === productId))
      .filter((product): product is Product => Boolean(product?.commerce))
      .slice(0, MAX_MISSION_SEEDS)
      .map((product): SimilaritySeed => ({
        kind: 'product',
        productId: product.id,
        name: product.name,
        shopProductId: product.commerce!.productId,
        category: product.category,
      }))
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
        categories: [...new Set(replacementNeeds.flatMap(need => need.categories ?? []))],
        retailerIds: [...session.mission.constraints.retailerIds],
        excludedRetailerIds: [...session.mission.constraints.excludedRetailerIds],
        storeDomains: [...(session.mission.constraints.storeDomains ?? [])],
        storeNames: [...(session.mission.constraints.storeNames ?? [])],
      },
      ...(seeds.length ? { seeds } : {}),
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
      return { searchId: reviewed.id, review: cloneRecommendationReview(reviewed.recommendationReview!), nextAction: 'research_again' as const, next: agentNext(reviewed) }
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
    return { searchId: reviewed.id, review: { ...cloneRecommendationReview(reviewed.recommendationReview!), replacementSearchId: replacement.searchId }, replacement, nextAction: 'claim_search_targets' as const }
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
    // Accepted products stay in front of the person: stopping early still hands them a timed review.
    session = { ...session, fulfillment: evaluateMissionFulfillment(session.mission, session.products) }
    if (!session.recommendationReview) session = { ...session, recommendationReview: createRecommendationReview(session, now) }
    commitSession(session, now)
    deps.notify?.(session.recommendationReview?.status === 'pending'
      ? `Research ${disposition === 'abandoned' ? 'abandoned' : 'stopped'}. Review the products found so far before Rove saves them.`
      : disposition === 'abandoned' ? 'Research abandoned. Existing candidates remain available.' : 'Research stopped. Existing candidates remain available.')
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
      next: agentNext(session),
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

  function addToCart(productId: string, options: CartSelection = {}, source: ActionSource = 'human'): AddToCartResult {
    const found = getProductById(productId)
    if (!found) throw new Error(`Product not found: ${productId}`)
    if (found.stage !== 'enriched') throw new Error('This candidate needs product enrichment before it can be added. Verify its exact options, stock and price.')
    let product = found
    const variant = product.commerce ? { size: options.size, color: options.color } : resolveCartVariant(product, options)
    const shopVariant = product.commerce ? matchVariant(product, variant.size, variant.color, options) : undefined
    if (product.commerce) {
      if (!shopVariant) throw new Error('This exact option combination has not been verified. Ask your agent to verify it through Shop before adding it.')
      if (!hasRequiredShopOptions(product, shopVariant)) throw new Error('Shop has not verified a size for this wearable item. Ask your agent to resolve the exact size before adding it.')
      if (!shopVariant.available) throw new Error(`${[variant.size, variant.color].filter(Boolean).join(' / ') || 'This option'} is sold out for ${product.name}.`)
      const priceCad = shopVariant.currency === 'CAD' && shopVariant.priceMinor !== undefined
        ? shopVariant.priceMinor / 100
        : shopVariant.priceCad
      if (priceCad === undefined || !Number.isFinite(priceCad) || priceCad <= 0) throw new Error('This exact Shop variant needs a verified CAD price.')
      product = { ...product, priceCad,
        nativePrice: shopVariant.priceMinor !== undefined && shopVariant.currency ? fromMinorUnits(shopVariant.priceMinor, shopVariant.currency) : product.nativePrice,
        nativeCurrency: shopVariant.currency ?? product.nativeCurrency, availability: 'in-stock', commerce: { ...product.commerce, variantId: shopVariant.id, selectedOptions: shopVariant.options.map(option => ({ ...option })), url: shopVariant.url ?? (product.commerce.variantId === shopVariant.id ? product.commerce.url : product.url) } }
      variant.size = shopVariant.size
      variant.color = shopVariant.color
    } else if (product.availability === 'out-of-stock') throw new Error(`${product.name} is marked out of stock.`)
    const id = cartItemId(product.id, variant.size, variant.color, shopVariant?.id)
    const existing = deps.cart.value.items.find(item => item.id === id)
    if (existing) {
      const refreshed = { ...existing, product: cloneProduct(product), selectedOptions: shopVariant?.options.map(option => ({ ...option })) }
      deps.cart.value = { ...deps.cart.value, items: deps.cart.value.items.map(item => item.id === id ? refreshed : item) }
      persistCart()
      if (existing.product.priceCad !== product.priceCad) deps.notify?.(`${product.name}'s verified price was updated in Your Thread.`)
      const summary = getCart()
      return { success: true, duplicate: true, item: refreshed, cartCount: summary.itemCount, totals: summary.totals }
    }
    const item = { id, productId: product.id, product, size: variant.size, color: variant.color, variantId: shopVariant?.id,
      selectedOptions: shopVariant?.options.map(option => ({ ...option })), addedAt: new Date().toISOString() }
    deps.cart.value = { ...deps.cart.value, version: 4, items: [...deps.cart.value.items, item] }
    persistCart()
    deps.notify?.(`${source === 'agent' ? 'Agent added ' : ''}${product.name}${source === 'agent' ? ' to' : ' added to'} Your Thread.`)
    const summary = getCart()
    return { success: true, duplicate: false, item: { ...item, product: cloneProduct(product) }, cartCount: summary.itemCount, totals: summary.totals }
  }

  function removeFromCart(itemId: string, source: ActionSource = 'human'): boolean {
    const item = deps.cart.value.items.find(candidate => candidate.id === itemId)
    if (!item) return false
    const remaining = { ...deps.cart.value, version: 4 as const, items: deps.cart.value.items.filter(candidate => candidate.id !== itemId) }
    deps.cart.value = { ...remaining, merchantCarts: pruneMerchantCarts(remaining) }
    persistCart()
    if (source === 'agent') deps.notify?.(`Agent removed ${item.product.name} from Your Thread.`)
    return true
  }

  function clearCart(): void {
    deps.cart.value = emptyCartState()
    persistCart()
  }

  function getCart(): CartSummary {
    const items = deps.cart.value.items.map(item => ({ ...item, selectedOptions: item.selectedOptions?.map(option => ({ ...option })), product: cloneProduct(item.product) }))
    const subtotal = items.reduce((sum, item) => sum + (item.product.priceCad ?? 0), 0)
    return {
      items,
      itemCount: items.length,
      totals: subtotal > 0 ? [{ currency: 'CAD', subtotal: Number(subtotal.toFixed(2)) }] : [],
      unpricedItemCount: items.filter(item => item.product.priceCad === undefined).length,
      groups: buildCheckoutGroups(deps.cart.value),
    }
  }

  function getCheckoutPlan() {
    const groups = buildCheckoutGroups(deps.cart.value)
    return {
      groups,
      shopGroupsNeedingCarts: groups.filter(group => group.status === 'needs-cart' || group.status === 'stale').map(group => group.key),
    }
  }

  function attachMerchantCart(input: {
    groupKey: string
    continueUrl: string
    cartId?: string
    total?: { amount: number; currency: string }
    messages?: string[]
  }) {
    const items = groupCartItems(deps.cart.value.items).get(input.groupKey)
    if (!items?.length) throw new Error(`No cart group found for ${input.groupKey}. Read get_checkout_plan first.`)
    const lead = items[0]!.product
    if (!lead.commerce) throw new Error('Only Shop-backed seller groups can hold a merchant cart; other stores use their retailer links.')
    if (items.some(item => !item.variantId || item.product.priceCad === undefined)) throw new Error('Verify every exact cart variant and its price before attaching a checkout.')
    let continueUrl: URL
    try {
      continueUrl = new URL(input.continueUrl.trim())
    } catch {
      throw new Error('continueUrl must be the complete continue_url returned by Shop.')
    }
    if (continueUrl.protocol !== 'https:' || continueUrl.username || continueUrl.password) throw new Error('continueUrl must use HTTPS.')
    if (input.total && (!Number.isInteger(input.total.amount) || input.total.amount < 0 || !/^[A-Z]{3}$/.test(input.total.currency.trim().toUpperCase()))) {
      throw new Error('total must be integer minor units with a three-letter currency.')
    }
    const merchantCart: MerchantCart = {
      groupKey: input.groupKey,
      sellerName: lead.commerce.sellerName ?? lead.retailer,
      itemsHash: groupItemsHash(items),
      // Shop requires the continue_url unchanged, so the raw string is stored rather than a re-serialized URL.
      continueUrl: input.continueUrl.trim(),
      cartId: input.cartId?.trim().slice(0, 200) || undefined,
      totalMinor: input.total?.amount,
      currency: input.total?.currency.trim().toUpperCase(),
      messages: [...(input.messages ?? [])],
      status: 'ready',
      updatedAt: new Date().toISOString(),
    }
    deps.cart.value = {
      ...deps.cart.value,
      version: 4,
      merchantCarts: [...deps.cart.value.merchantCarts.filter(candidate => candidate.groupKey !== input.groupKey), merchantCart],
    }
    persistCart()
    deps.notify?.(`Checkout ready at ${merchantCart.sellerName}.`)
    return { merchantCart: { ...merchantCart, messages: [...merchantCart.messages] }, plan: getCheckoutPlan() }
  }

  function cloneInspiration(item: InspirationItem): InspirationItem {
    return { ...item, needIds: [...item.needIds] }
  }

  function getInspiration(): InspirationItem[] {
    return inspiration.value.items.map(cloneInspiration)
  }

  function addInspiration(input: {
    source: InspirationSource
    imageUrl?: string
    imageData?: string
    sourceUrl?: string
    note?: string
    needIds?: string[]
    searchId?: string
    targetId?: string
  }, actor: ActionSource = 'human'): InspirationItem {
    if (inspiration.value.items.length >= MAX_INSPIRATION_ITEMS) {
      throw new Error(`Your inspiration board holds ${MAX_INSPIRATION_ITEMS} images. Remove one before adding another.`)
    }
    const now = new Date().toISOString()
    const note = input.note?.trim().replace(/\s+/g, ' ').slice(0, 200) || undefined
    let imageUrl: string | undefined
    let imageData: string | undefined
    let sourceUrl: string | undefined
    if (input.source === 'upload') {
      imageData = input.imageData?.trim()
      if (!imageData || imageData.length > MAX_INSPIRATION_DATA_URL_LENGTH) throw new Error('Upload a downscaled image under 150 KB.')
      imageLikeEntry(imageData)
    } else {
      const image = new URL(input.imageUrl?.trim() ?? '')
      if (image.protocol !== 'https:') throw new Error('imageUrl must be a direct HTTPS image URL.')
      imageUrl = image.toString()
      if (input.sourceUrl) {
        const pin = new URL(input.sourceUrl.trim())
        if (pin.protocol !== 'https:' || !PINTEREST_HOST.test(pin.hostname)) throw new Error('sourceUrl must be the Pinterest pin URL.')
        sourceUrl = pin.toString()
      }
      if (inspiration.value.items.some(item => item.imageUrl === imageUrl)) throw new Error('This pin is already on your inspiration board.')
    }
    let needIds: string[] = []
    let targetId: string | undefined
    let searchId: string | undefined
    if (input.searchId) {
      const session = currentSession(input.searchId, true)
      searchId = session.id
      const known = new Set(session.mission.needs.map(need => need.id))
      needIds = [...new Set(input.needIds ?? [])]
      if (!needIds.every(id => known.has(id))) throw new Error('needIds must belong to this mission.')
      if (input.targetId) {
        const target = session.targets.find(candidate => candidate.id === input.targetId)
        if (!target || target.id !== 'discovery:pinterest') throw new Error('Pins can only be attached to this mission’s Pinterest target.')
        if (!['claimed', 'exploring'].includes(target.status)) throw new Error('Claim the Pinterest target before pinning inspiration to it.')
        targetId = target.id
      }
    } else if (input.targetId || input.needIds?.length) {
      throw new Error('searchId is required when attaching inspiration to a target or need.')
    }
    const item: InspirationItem = {
      id: `inspiration:${stableHash(`${imageUrl ?? imageData!.slice(0, 2_000)}:${now}`)}`,
      source: input.source,
      imageUrl,
      imageData,
      sourceUrl,
      note,
      needIds,
      searchId,
      targetId,
      addedAt: now,
    }
    inspiration.value = { version: 1, items: [...inspiration.value.items, item] }
    persistInspiration()
    deps.notify?.(actor === 'agent' ? 'Agent pinned inspiration from Pinterest.' : 'Added to your inspiration board.')
    return cloneInspiration(item)
  }

  function removeInspiration(inspirationId: string): boolean {
    const exists = inspiration.value.items.some(item => item.id === inspirationId)
    if (!exists) return false
    inspiration.value = { version: 1, items: inspiration.value.items.filter(item => item.id !== inspirationId) }
    persistInspiration()
    return true
  }

  function similaritySeed(input: { productId?: string; inspirationId?: string }): SimilaritySeed {
    if (input.productId && input.inspirationId) throw new Error('Choose either a product or an inspiration image, not both.')
    if (input.productId) {
      const product = getProductById(input.productId)
      if (!product) throw new Error(`Product not found: ${input.productId}`)
      return { kind: 'product', productId: product.id, name: product.name, shopProductId: product.commerce?.productId, category: product.category }
    }
    if (input.inspirationId) {
      const item = inspiration.value.items.find(candidate => candidate.id === input.inspirationId)
      if (!item) throw new Error(`Inspiration not found: ${input.inspirationId}`)
      return { kind: 'image', inspirationId: item.id, source: item.source, imageUrl: item.imageUrl, note: item.note }
    }
    throw new Error('Provide a productId or an inspirationId.')
  }

  /** "More like this" and "Shop this look": joins the active mission, or starts a focused follow-up mission. */
  function findSimilar(input: { productId?: string; inspirationId?: string }, actor: ActionSource = 'human') {
    const seed = similaritySeed(input)
    const label = seed.kind === 'product' ? seed.name : 'this look'
    const active = deps.search.value.activeSearch
    if (active?.status === 'active') {
      const targetId = similarityTargetId(seed)
      if (active.targets.some(target => target.id === targetId)) throw new Error(`Rove is already looking for more like ${label} in this mission.`)
      if (active.targets.filter(target => target.seed).length >= MAX_SIMILARITY_TARGETS) {
        throw new Error(`This mission already has ${MAX_SIMILARITY_TARGETS} similarity searches. Let them finish first.`)
      }
      const now = new Date().toISOString()
      const target = createSimilarityTarget(seed, active.mission, deps.profile.value, Math.max(0, ...active.targets.map(item => item.rank)) + 1)
      let session: SearchSession = { ...active, targets: [...active.targets, target] }
      session = appendTrace(session, { type: 'targets_ranked', targetId: target.id, message: `Added ${target.name}.`, at: now })
      session = commitSession(session, now)
      deps.notify?.(actor === 'agent' ? `Agent is looking for more like ${label}.` : `Looking for more like ${label}.`)
      return { mode: 'appended' as const, searchId: session.id, target: withSeedImage(cloneTarget(target), session), nextAction: 'claim_search_targets' as const }
    }
    if (active?.recommendationReview?.status === 'pending') throw new Error('Review the current recommendations before starting a similarity search.')
    const product = seed.kind === 'product' ? getProductById(seed.productId) : undefined
    const note = seed.kind === 'image' ? seed.note : undefined
    const started = startShoppingSearch({
      rawPrompt: seed.kind === 'product' ? `More like ${seed.name}` : `Shop this look${note ? `: ${note}` : ''}`,
      // An image starts a mission it guides; a product is just a similarity anchor.
      ...(seed.kind === 'image' ? { context: { visualGuide: { inspirationId: seed.inspirationId, palette: [], descriptors: [] } } } : {}),
      needs: [{
        intent: seed.kind === 'product' ? `more like ${seed.name}` : 'pieces like this look',
        queries: [seed.kind === 'product' ? seed.name : note || 'outfit inspiration'],
        categories: product?.category ? [product.category] : [],
        required: true,
        quantity: 1,
      }],
      seeds: [seed],
    })
    return { mode: 'new-mission' as const, ...started }
  }

  /** Records purchases the agent reported from Shop; only seller, brand, product link, and order link are kept. */
  function recordPurchases(input: {
    source: 'checkout' | 'order-history'
    purchases: Array<{ sellerDomain?: string; productUrl?: string; brand?: string; orderPermalink?: string }>
  }) {
    if (!Array.isArray(input.purchases) || !input.purchases.length || input.purchases.length > 50) {
      throw new Error('Report between 1 and 50 purchases.')
    }
    const productUrls: string[] = []
    const brands: string[] = []
    const orderedGroups = new Map<string, string | undefined>()
    const rejected: Array<{ index: number; reason: string }> = []
    input.purchases.forEach((purchase, index) => {
      try {
        if (purchase.productUrl) {
          const url = new URL(purchase.productUrl.trim())
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('productUrl must use HTTP or HTTPS.')
          productUrls.push(url.toString())
        }
        const brand = purchase.brand?.trim().replace(/\s+/g, ' ').slice(0, 80)
        if (brand) brands.push(brand)
        if (input.source === 'checkout') {
          const sellerDomain = purchase.sellerDomain?.trim().toLowerCase()
          if (!sellerDomain) throw new Error('sellerDomain is required for a completed checkout.')
          const permalink = purchase.orderPermalink ? new URL(purchase.orderPermalink.trim()) : undefined
          if (permalink && permalink.protocol !== 'https:') throw new Error('orderPermalink must use HTTPS.')
          orderedGroups.set(`shop:${sellerDomain}`, permalink?.toString())
        }
      } catch (error) {
        rejected.push({ index, reason: error instanceof Error ? error.message : 'Invalid purchase.' })
      }
    })
    persistResearchHistory(recordPurchaseSignals(readResearchHistory(), productUrls, brands))
    const now = new Date().toISOString()
    const markedOrdered = deps.cart.value.merchantCarts.filter(merchantCart => orderedGroups.has(merchantCart.groupKey)).map(merchantCart => merchantCart.groupKey)
    if (markedOrdered.length) {
      deps.cart.value = {
        ...deps.cart.value,
        merchantCarts: deps.cart.value.merchantCarts.map(merchantCart => orderedGroups.has(merchantCart.groupKey)
          ? { ...merchantCart, status: 'ordered' as const, orderPermalink: orderedGroups.get(merchantCart.groupKey) ?? merchantCart.orderPermalink, updatedAt: now }
          : merchantCart),
      }
      persistCart()
      deps.notify?.(`Order confirmed at ${markedOrdered.length === 1 ? deps.cart.value.merchantCarts.find(item => item.groupKey === markedOrdered[0])!.sellerName : `${markedOrdered.length} stores`}.`)
    }
    return {
      recorded: input.purchases.length - rejected.length,
      rejected,
      markedOrdered,
      purchasedBrands: readResearchHistory().purchasedBrands,
    }
  }

  /**
   * Starts a mission from a brief, optionally guided by a reference image. The image joins the inspiration board,
   * becomes the mission's visual guide, and seeds one Shop visual search per wearable need. Without an image the
   * mission runs exactly as briefed.
   */
  function startGuidedSearch(
    input: SearchMissionInput,
    guide: { imageData?: string; inspirationId?: string; palette?: string[]; descriptors?: string[] } = {},
    actor: ActionSource = 'human',
  ) {
    const existing = deps.search.value.activeSearch
    if (existing?.recommendationReview?.status === 'pending') expireRecommendationReview(existing.id)
    if (deps.search.value.activeSearch?.status === 'active') {
      throw new Error('A shopping search is already active. Complete, satisfy, cancel, or abandon it before starting another mission.')
    }
    if (deps.search.value.activeSearch?.recommendationReview?.status === 'pending') {
      throw new Error('Review the current recommendations before starting another mission.')
    }
    if (guide.imageData && guide.inspirationId) throw new Error('Send either a new reference image or an existing inspirationId, not both.')
    const created = guide.imageData
      ? addInspiration({ source: 'upload', imageData: guide.imageData, note: `Guide for “${input.rawPrompt.trim().slice(0, 60)}”` }, actor)
      : undefined
    const item = created ?? (guide.inspirationId ? inspiration.value.items.find(candidate => candidate.id === guide.inspirationId) : undefined)
    if (guide.inspirationId && !item) throw new Error(`Inspiration not found: ${guide.inspirationId}`)
    const palette = guide.palette ?? []
    const descriptors = guide.descriptors ?? []
    const visualGuide: VisualGuide | undefined = item || palette.length || descriptors.length
      ? { inspirationId: item?.id, palette, descriptors }
      : undefined
    const seed: SimilaritySeed[] = item
      ? [{ kind: 'image', inspirationId: item.id, source: item.source, imageUrl: item.imageUrl, note: item.note }]
      : []
    let started: ReturnType<typeof startShoppingSearch>
    try {
      started = startShoppingSearch({
        ...input,
        context: { ...input.context, ...(visualGuide ? { visualGuide } : {}) },
        seeds: [...seed, ...(input.seeds ?? [])],
      })
    } catch (error) {
      if (created) removeInspiration(created.id)
      throw error
    }
    if (item) {
      inspiration.value = {
        version: 1,
        items: inspiration.value.items.map(candidate => candidate.id === item.id ? { ...candidate, searchId: started.searchId } : candidate),
      }
      persistInspiration()
      deps.notify?.('Rove will use your photo as the style guide for this mission.')
    }
    return { ...started, guide: started.mission.context.visualGuide ?? null }
  }

  /** The person's saved size for a product's category; swimwear and activewear fall back to their top size. */
  function statedSize(category: ProductCategory | undefined): string | undefined {
    const profile = deps.profile.value
    if (!profile || category === 'fragrance' || category === 'accessories') return undefined
    if (category === 'footwear') return profile.shoeSize
    const sizes = profile.clothingSizes ?? {}
    return category && category in sizes ? sizes[category as keyof typeof sizes] : sizes.tops
  }

  const ONE_SIZE = /^(?:one[\s-]?size|os|o\/s|one size fits all)$/i

  /** Matches known size synonyms only; never guess between US, UK and EU numeric sizes. */
  function listingSize(product: Product): string | undefined {
    const stated = statedSize(product.category)
    if (!stated) return undefined
    return product.sizes.find(size => matchesSavedSize(size, stated))
  }

  /**
   * A sized piece is added only in the person's own size. Without a saved size, or when the listing does not offer it,
   * the person decides; a merchant's featured size or the first label on the page is never a choice.
   */
  function sizeDecision(product: Product): { reason: string; steps: AgentStep[] } | null {
    if (!SIZED_PRODUCT_CATEGORIES.has(product.category ?? '') || !product.sizes.length) return null
    if (product.sizes.length === 1 && ONE_SIZE.test(product.sizes[0]!)) return null
    const saved = statedSize(product.category)
    if (saved && listingSize(product)) return null
    const onlyFeatured = Boolean(product.commerce) && product.sizes.length === 1
    // Shop sometimes reports only the featured size; with a saved size, verification reads the real labels first.
    if (saved && onlyFeatured) return null
    const offered = product.sizes.join(', ')
    const sizeKey = ['tops', 'bottoms', 'dresses', 'outerwear'].includes(product.category!) ? product.category! : 'tops'
    const profileUpdate = product.category === 'footwear' ? { shoeSize: '<size the person chose>' } : { clothingSizes: { [sizeKey]: '<size the person chose>' } }
    const readSizes: AgentStep[] = onlyFeatured && product.commerce
      ? [{ server: 'rove', tool: 'inspect_shop_product', arguments: { searchId: product.searchId, productId: product.id, requestedOptions: product.commerce.selectedOptions.filter(option => !isSizeOption(option.name)) }, why: 'Shop reported only its featured size; read every offered size label.' }]
      : []
    return {
      reason: saved
        ? `Your saved size ${saved} is not offered for this listing. Offered: ${offered}.`
        : onlyFeatured
          ? `No saved ${product.category === 'footwear' ? 'shoe' : product.category} size, and Shop reported only its featured size ${offered}.`
          : `No saved ${product.category === 'footwear' ? 'shoe' : product.category} size. Offered: ${offered}.`,
      steps: [
        ...readSizes,
        { server: 'person', tool: 'choose_size', arguments: { productId: product.id, options: [...product.sizes] }, why: saved ? 'Ask whether another offered size fits, or replace this piece.' : 'Ask which size to buy; never use the merchant\'s featured size.' },
        { server: 'rove', tool: 'update_profile', arguments: profileUpdate, why: 'Save the size the person gives, then retry cart_proposed_basket so every piece uses it.' },
      ],
    }
  }

  /**
   * Adds the accepted basket to Your Thread in the person's sizes. Anything that still needs a stock check or a size
   * choice comes back with the exact next step instead of being guessed.
   */
  function cartProposedBasket(input: { searchId?: string } = {}, actor: ActionSource = 'agent') {
    const session = currentSession(input.searchId)
    const review = session.recommendationReview
    if (review?.status === 'pending') {
      throw new Error('The person has not reviewed this basket yet. Present it first, or wait for automatic acceptance.')
    }
    const productIds = review ? review.likedProductIds : session.fulfillment.selectedProductIds
    const reviewedSubtotal = productIds.reduce((total, id) => total + (getProductById(id)?.priceCad ?? 0), 0)
    if (session.mission.constraints.overallBudgetCad !== undefined && reviewedSubtotal > session.mission.constraints.overallBudgetCad) throw new Error('Verified prices now exceed the basket budget. Review replacements before adding this basket.')
    const added: Array<{ productId: string; itemId: string; size?: string; color?: string; assumed: string[] }> = []
    const needsAction: Array<{ productId: string; name: string; reason: string; steps: AgentStep[] }> = []
    for (const productId of productIds) {
      const product = getProductById(productId)
      if (!product) continue
      const verificationSteps = (): AgentStep[] => {
        if (!product.commerce) return [
          { server: 'browser', tool: 'open', arguments: { url: product.url }, why: 'Check price and stock, and read every size and colour the page offers.' },
          { server: 'rove', tool: 'enrich_product', arguments: { searchId: session.id, productId }, why: 'Store the observed evidence with every offered size and colour (sizes, colors), then retry cart_proposed_basket.' },
        ]
        const featured = product.commerce.selectedOptions.map(option => ({ ...option }))
        const desired = statedSize(product.category)
        const exact = listingSize(product)
        const sizeName = featured.find(option => isSizeOption(option.name))?.name ?? 'Size'
        // The featured size is Shop's pick, not the person's: request their size, or leave size open to read the labels.
        const selected = featured.filter(option => !isSizeOption(option.name))
        if (exact) selected.push({ name: sizeName, label: exact })
        else if (!SIZED_PRODUCT_CATEGORIES.has(product.category ?? '')) selected.splice(0, selected.length, ...featured)
        // An empty selection is sent explicitly: an omitted one falls back to the featured size.
        const requested = selected.length || SIZED_PRODUCT_CATEGORIES.has(product.category ?? '') ? { requestedOptions: selected } : {}
        return [
          { server: 'rove', tool: 'inspect_shop_product', arguments: { searchId: session.id, productId,
            ...requested },
            why: !exact && SIZED_PRODUCT_CATEGORIES.has(product.category ?? '')
              ? desired
                ? `Read the merchant's exact size labels first, then verify the saved size ${desired} with get_product. Do not substitute another size or relax an option.`
                : 'Read the offered sizes; the person has no saved size for this piece, so ask before verifying one.'
              : 'Verify every requested option, stock, price and checkout_url. Compare the effective selection; do not accept substitutions.' },
          { server: 'rove', tool: 'enrich_product', arguments: { searchId: session.id, productId, shopProductId: product.commerce.productId,
            ...requested },
            why: 'Copy one exact returned variant, including price and checkoutUrl. Supply the actual requestedOptions after resolving labels; mismatches are rejected. Then retry cart_proposed_basket.' },
        ]
      }
      const decision = sizeDecision(product)
      if (decision) {
        needsAction.push({ productId, name: product.name, ...decision })
        continue
      }
      if (product.stage !== 'enriched') {
        needsAction.push({ productId, name: product.name, reason: 'Verify the requested options, price and stock before adding.', steps: verificationSteps() })
        continue
      }
      if (!product.commerce && SIZED_PRODUCT_CATEGORIES.has(product.category ?? '') && !product.sizes.length) {
        needsAction.push({ productId, name: product.name, reason: 'The offered sizes were not recorded for this listing.', steps: verificationSteps() })
        continue
      }
      const policy = getProductVariantPolicy(product)
      const assumed: string[] = []
      const savedSize = statedSize(product.category)
      const size = (policy.requiresSize || (product.commerce && savedSize)) ? listingSize(product) : undefined
      if (product.commerce && savedSize && !size) {
        needsAction.push({ productId, name: product.name, reason: `The saved size ${savedSize} has not been verified for this listing.`, steps: verificationSteps() })
        continue
      }
      if (policy.requiresSize && !size) {
        needsAction.push({
          productId,
          name: product.name,
          reason: `Choose a size: ${policy.sizeOptions.join(', ')}.`,
          steps: [{ server: 'person', tool: 'choose_size', arguments: { productId, options: policy.sizeOptions }, why: 'No saved profile size matches this listing.' }],
        })
        continue
      }
      // The presented image shows the featured colour, so that is the colour the person reviewed.
      const featured = product.commerce?.selectedOptions.find(option => isColorOption(option.name))?.label
      const color = policy.requiresColor ? (featured && policy.colorOptions.includes(featured) ? featured : product.commerce ? undefined : policy.colorOptions[0]) : undefined
      if (policy.requiresColor && !color) {
        needsAction.push({ productId, name: product.name, reason: 'Choose a colour before adding.', steps: [{ server: 'person', tool: 'choose_color', arguments: { productId, options: policy.colorOptions }, why: 'No colour has been selected.' }] })
        continue
      }
      try {
        const result = addToCart(product.id, { size, color }, actor)
        added.push({ productId, itemId: result.item.id, size: result.item.size, color: result.item.color, assumed })
      } catch (error) {
        needsAction.push({
          productId,
          name: product.name,
          reason: error instanceof Error ? error.message : 'Could not add this product.',
          steps: verificationSteps(),
        })
      }
    }
    return {
      searchId: session.id,
      added,
      needsAction,
      cart: getCart(),
      next: JSON.parse(JSON.stringify(needsAction.length
        ? needsAction.flatMap(item => item.steps)
        : [{ server: 'rove', tool: 'get_checkout_plan', why: 'Prepare Shop carts per store only when the person asks to check out.' }])) as AgentStep[],
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
    resolveStore,
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
    getShopRequest,
    getVisibleProducts,
    getRetailers,
    getExecutionTrace,
    addToCart,
    removeFromCart,
    clearCart,
    getCart,
    getCheckoutPlan,
    attachMerchantCart,
    getInspiration,
    addInspiration,
    removeInspiration,
    findSimilar,
    recordPurchases,
    startGuidedSearch,
    cartProposedBasket,
  }
}
