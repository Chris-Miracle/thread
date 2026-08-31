import { buildRetailerSearchUrls, rankRetailers } from '~/data/retailers'
import { stableHash } from '~/domain/productIdentity'
import type {
  MissionNeed, ResearchTarget, SearchCoverage, SearchMission, SearchSession, ShoppingDepartment, StyleProfile,
} from '~/types/thread'

const DISCOVERY_SOURCES = [
  {
    id: 'discovery:pinterest',
    name: 'Pinterest',
    domain: 'pinterest.com',
    template: 'https://www.pinterest.com/search/pins/?q={query}',
  },
  {
    id: 'discovery:google-shopping',
    name: 'Google Shopping',
    domain: 'google.com',
    template: 'https://www.google.com/search?tbm=shop&q={query}',
  },
] as const

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

export function createResearchTargets(mission: SearchMission, profile: StyleProfile | null): ResearchTarget[] {
  const ranked = rankRetailers(mission, profile)
  const supportsNeed = (categories: readonly string[], need: MissionNeed) => !need.categories.length
    || need.categories.some(category => categories.includes(category))
  const retailerTargets = ranked.flatMap(({ retailer, score }) => {
    const supportedNeeds = mission.needs.filter(need => supportsNeed(retailer.capabilities.categories, need))
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
  }).map((target, index) => ({ ...target, rank: index + 1 }))

  if (mission.constraints.retailerIds.length) return retailerTargets

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
    rank: retailerTargets.length + index + 1,
    needIds: mission.needs.map(need => need.id),
    queries: [...mission.derivedQueries],
    searchUrls: mission.derivedQueries.slice(0, 4).map(query => source.template.replace('{query}', encodeURIComponent(query))),
    note: 'Discovery only. Publish the final canonical retailer product page, never this discovery URL.',
  }))
  return [...retailerTargets, ...discoveryTargets]
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
      .toSorted((left, right) => right.priorityScore - left.priorityScore || left.rank - right.rank || left.id.localeCompare(right.id))
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
