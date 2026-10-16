import { buildRetailerSearchUrls, rankRetailers } from '~/data/retailers'
import { stableHash } from '~/domain/productIdentity'
import { matchesStore, needStoreDomains } from '~/domain/search/stores'
import { SHOP_LOGO, buildCatalogRequests, buildSimilarityRequests, isGuideSeed, visualNeeds } from '~/domain/research/shopRequests'
import type {
  MissionNeed, ResearchTarget, SearchCoverage, SearchMission, SearchSession, ShoppingDepartment, SimilaritySeed, StyleProfile,
} from '~/types/thread'

const DISCOVERY_SOURCES = [
  {
    id: 'discovery:pinterest',
    name: 'Pinterest',
    domain: 'pinterest.com',
    template: 'https://www.pinterest.com/search/pins/?q={query}',
    note: 'Inspiration source. Pin 3–6 images that fit the brief with add_inspiration (pass this targetId), then complete the target. Publish a canonical retailer product page only when a pin links to one; never publish Pinterest URLs as products.',
  },
  {
    id: 'discovery:google-shopping',
    name: 'Google Shopping',
    domain: 'google.com',
    template: 'https://www.google.com/search?tbm=shop&q={query}',
    note: 'Discovery only. Publish the final canonical retailer product page, never this discovery URL.',
  },
] as const

// Shop catalogue targets return structured, in-stock products, so they are claimed before page browsing.
export const CATALOG_PRIORITY_BONUS = 200
// Searches anchored on something the person showed or picked come before plain catalogue text searches.
export const SEEDED_PRIORITY_BONUS = 40

function discoveryLogo(domain: string): string {
  return `https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128`
}

function baseTarget(): Pick<ResearchTarget, 'status' | 'productCount' | 'rejectedCount' | 'note' | 'claimId' | 'claimedBy' | 'claimedAt' | 'updatedAt'> {
  return {
    status: 'queued',
    productCount: 0,
    rejectedCount: 0,
    note: '',
    claimId: null,
    claimedBy: null,
    claimedAt: null,
    updatedAt: null,
  }
}

export const MAX_SIMILARITY_TARGETS = 4

export function similarityTargetId(seed: SimilaritySeed, needId?: string): string {
  const base = `similar:${stableHash(seed.kind === 'product' ? `product:${seed.productId}` : `image:${seed.inspirationId}`)}`
  return needId ? `${base}:${needId}` : base
}

function seedNeeds(seed: SimilaritySeed, mission: SearchMission): MissionNeed[] {
  if (seed.kind === 'product' && seed.category) {
    const matching = mission.needs.filter(need => !need.categories.length || need.categories.includes(seed.category!))
    if (matching.length) return matching
  }
  return mission.needs
}

/**
 * A Shop catalogue target that searches for items like one product or inspiration image. Passing a need scopes a
 * mission's guide image to that need ("sandals like this photo"), so every wearable need gets its own visual search.
 */
export function createSimilarityTarget(
  seed: SimilaritySeed,
  mission: SearchMission,
  profile: StyleProfile | null,
  rank: number,
  scopedNeed?: MissionNeed,
): ResearchTarget {
  const needs = scopedNeed ? [scopedNeed] : seedNeeds(seed, mission)
  const catalogRequests = buildSimilarityRequests(seed, needs[0]!, mission, profile)
  const source = seed.kind === 'image' ? (seed.source === 'pinterest' ? 'Pinterest pin' : 'your photo') : ''
  const name = seed.kind === 'product'
    ? `More like ${seed.name}`
    : scopedNeed ? `Like ${source} · ${scopedNeed.intent}` : `Shop this look · ${source}`
  const note = seed.kind === 'image' && seed.source === 'pinterest'
    ? 'Fetch the pin image at seed.imageUrl and send its base64 bytes to Shop search_catalog as like:[{image:{content_type,data}}], reusing the context and filters below. Use the built-in search_shop_catalog tool for browser HTTP. Only an actual request error establishes a connection failure; preserve its reason.'
    : 'Run each catalogue request with Rove search_shop_catalog. Use the built-in search_shop_catalog tool for browser HTTP. Only an actual request error establishes a connection failure; preserve its reason.'
  return {
    ...baseTarget(),
    id: similarityTargetId(seed, scopedNeed?.id),
    retailerId: 'shop',
    name,
    logo: SHOP_LOGO,
    sourceType: 'catalog',
    relevanceScore: 100,
    priorityScore: 100,
    priorityReasons: ['visual similarity through Shop'],
    rank,
    needIds: needs.map(need => need.id),
    queries: catalogRequests.flatMap(request => request.arguments.catalog.query ? [request.arguments.catalog.query] : []),
    searchUrls: [],
    note,
    catalogRequests,
    seed: { ...seed },
  }
}

export function createResearchTargets(mission: SearchMission, profile: StyleProfile | null): ResearchTarget[] {
  const ranked = rankRetailers({ ...mission, constraints: { ...mission.constraints, retailerIds: [] } }, profile)
  const supportsStore = (domains: readonly string[], need: MissionNeed) => {
    const allowed = needStoreDomains(need, mission)
    return !allowed.length || domains.some(domain => matchesStore(`https://${domain}`, allowed))
  }
  const supportsNeed = (categories: readonly string[], need: MissionNeed) => !need.categories.length
    || need.categories.some(category => categories.includes(category))
  const namedStoreTargets: ResearchTarget[] = [...new Set([...(mission.constraints.storeDomains ?? []), ...mission.needs.flatMap(need => need.storeDomains ?? [])])].map(domain => {
    const needs = mission.needs.filter(need => supportsStore([domain], need))
    return {
    ...baseTarget(), id: `store:${domain}`, retailerId: `store:${domain}`, name: domain,
    logo: discoveryLogo(domain), sourceType: 'discovery' as const, relevanceScore: 50, priorityScore: 50,
    priorityReasons: ['requested official store fallback'], rank: 0,
    needIds: needs.map(need => need.id), queries: [...new Set(needs.flatMap(need => need.queries))],
    searchUrls: [`https://${domain}/`],
    note: 'Use this official store’s search UI for the requested queries. Preserve the named-store constraint if Shop is unavailable or lacks this merchant.',
  } }).filter(target => target.needIds.length > 0 && !ranked.some(({ retailer }) => retailer.domains.includes(target.name)))
  const retailerTargets = ranked.flatMap(({ retailer, score }) => {
    const supportedNeeds = mission.needs.filter(need => supportsNeed(retailer.capabilities.categories, need) && supportsStore(retailer.domains, need))
    if (!supportedNeeds.length) return []
    const queries = [...new Set(supportedNeeds.flatMap(need => need.queries))]
    return [{
      ...baseTarget(),
      id: `target:${retailer.id}`,
      retailerId: retailer.id,
      name: retailer.name,
      logo: retailer.logo,
      sourceType: 'retailer' as const,
      relevanceScore: score,
      priorityScore: score,
      priorityReasons: ['initial retailer relevance'],
      rank: 0,
      needIds: supportedNeeds.map(need => need.id),
      queries,
      searchUrls: buildRetailerSearchUrls(retailer, mission, queries),
    }]
  })

  const catalogTargets = mission.needs.flatMap((need): ResearchTarget[] => {
    const catalogRequests = buildCatalogRequests(need, mission, profile)
    if (!catalogRequests.length) return []
    return [{
      ...baseTarget(),
      id: `catalog:${need.id}`,
      retailerId: 'shop',
      name: `Shop catalogue · ${need.intent}`,
      logo: SHOP_LOGO,
      sourceType: 'catalog',
      relevanceScore: 100,
      priorityScore: 100,
      priorityReasons: ['structured Shop catalogue'],
      rank: 0,
      needIds: [need.id],
      queries: catalogRequests.map(request => request.arguments.catalog.query!),
      searchUrls: [],
      note: 'Call Rove search_shop_catalog for each requestIndex. Browser HTTP works anonymously without a separate Shop installation. Only mark Shop unavailable after an actual request failure; preserve the returned error reason. Empty search results mean no matching offers.',
      catalogRequests,
    }]
  })
  const similarityTargets = (mission.seeds ?? []).flatMap(seed => isGuideSeed(seed, mission)
    ? visualNeeds(mission).map(need => createSimilarityTarget(seed, mission, profile, 0, need))
    : [createSimilarityTarget(seed, mission, profile, 0)])
  const guided = (mission.seeds ?? []).some(seed => isGuideSeed(seed, mission))
  const shopTargets = guided ? [...similarityTargets, ...catalogTargets] : [...catalogTargets, ...similarityTargets]
  const plannedTargets = [...shopTargets, ...retailerTargets, ...namedStoreTargets].map((target, index) => ({ ...target, rank: index + 1 }))

  if (mission.constraints.retailerIds.length || mission.constraints.storeDomains?.length) return plannedTargets

  const discoveryTargets = DISCOVERY_SOURCES.map((source, index): ResearchTarget => ({
    ...baseTarget(),
    id: source.id,
    retailerId: source.id,
    name: source.name,
    logo: discoveryLogo(source.domain),
    sourceType: 'discovery',
    relevanceScore: -10 - index,
    priorityScore: -10 - index,
    priorityReasons: ['discovery fallback'],
    rank: plannedTargets.length + index + 1,
    needIds: mission.needs.map(need => need.id),
    queries: [...mission.derivedQueries],
    searchUrls: mission.derivedQueries.slice(0, 4).map(query => source.template.replace('{query}', encodeURIComponent(query))),
    note: source.note,
  }))
  return [...plannedTargets, ...discoveryTargets]
}

export function claimSearchTargets(
  session: SearchSession,
  limit: number,
  workerId: string,
  now = new Date().toISOString(),
): { targets: ResearchTarget[]; claimed: ResearchTarget[] } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 4) throw new Error('Claim between 1 and 4 search targets.')
  const targets = session.targets
  const unresolvedNeeds = session.fulfillment.needs.filter(need => !need.satisfied)
  const supporterCount = new Map(unresolvedNeeds.map(need => [
    need.needId,
    Math.max(1, targets.filter(target => target.status === 'queued' && target.needIds.includes(need.needId)).length),
  ]))
  const prioritized = targets.map((target): ResearchTarget => {
    const reasons: string[] = []
    let priorityScore = target.relevanceScore
    for (const need of unresolvedNeeds) {
      if (!target.needIds.includes(need.needId)) continue
      const needWeight = need.required ? 60 : 15
      const scarcityBonus = 30 / (supporterCount.get(need.needId) ?? 1)
      priorityScore += needWeight + scarcityBonus
      reasons.push(`${need.required ? 'required' : 'optional'} unmet need: ${need.intent}`)
    }
    if (target.sourceType === 'discovery') priorityScore -= 25
    if (target.sourceType === 'catalog' && reasons.length) {
      priorityScore += CATALOG_PRIORITY_BONUS + (target.seed ? SEEDED_PRIORITY_BONUS : 0)
      reasons.push(target.seed ? 'visual guide through Shop' : 'structured Shop catalogue')
    }
    if (!reasons.length) reasons.push('base retailer relevance')
    return {
      ...target,
      priorityScore: Number(priorityScore.toFixed(3)),
      priorityReasons: reasons,
      needIds: [...target.needIds],
      queries: [...target.queries],
      searchUrls: [...target.searchUrls],
    }
  })
  const chosenIds = new Set(
    prioritized
      .filter(target => target.status === 'queued')
      .toSorted((left, right) => Number(right.sourceType === 'catalog' && unresolvedNeeds.some(need => right.needIds.includes(need.needId)))
        - Number(left.sourceType === 'catalog' && unresolvedNeeds.some(need => left.needIds.includes(need.needId)))
        || right.priorityScore - left.priorityScore || left.rank - right.rank || left.id.localeCompare(right.id))
      .slice(0, limit)
      .map(target => target.id),
  )
  const nextTargets = prioritized.map((target): ResearchTarget => {
    if (!chosenIds.has(target.id)) return target
    return {
      ...target,
      status: 'claimed',
      claimId: `claim:${stableHash(`${target.id}:${workerId}:${now}`)}`,
      claimedBy: workerId,
      claimedAt: now,
      updatedAt: now,
      queries: [...target.queries],
      searchUrls: [...target.searchUrls],
    }
  })
  return {
    targets: nextTargets,
    claimed: nextTargets.filter(target => chosenIds.has(target.id)),
  }
}

export function getSearchCoverage(session: SearchSession): SearchCoverage {
  const targets = session.targets
  const count = (status: ResearchTarget['status']) => targets.filter(target => target.status === status).length
  const queuedTargets = count('queued')
  const claimedTargets = count('claimed')
  const activeTargets = count('exploring')
  const completedTargets = count('complete')
  const noResultTargets = count('no-results')
  const failedTargets = count('failed')
  const cancelledTargets = count('cancelled')
  const skippedTargets = count('skipped')
  return {
    eligibleRetailers: targets.filter(target => target.sourceType === 'retailer').length,
    totalTargets: targets.length,
    queuedTargets,
    claimedTargets,
    activeTargets,
    completedTargets,
    noResultTargets,
    failedTargets,
    cancelledTargets,
    skippedTargets,
    acceptedCandidateCount: session.acceptedCandidateCount,
    rejectedCandidateCount: session.rejectedCandidateCount,
    unresolvedTargets: queuedTargets + claimedTargets + activeTargets,
  }
}

export function isDepartmentEligible(
  productDepartment: ShoppingDepartment | undefined,
  missionDepartment: ShoppingDepartment,
): boolean {
  return missionDepartment === 'all'
    || productDepartment === 'all'
    || productDepartment === missionDepartment
}
