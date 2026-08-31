import type { Product, RankingTrace, SearchSession } from '~/types/thread'

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'from', 'in', 'of', 'the', 'to', 'with', 'women', 'womens', 'men', 'mens'])

function tokens(value: string | undefined): string[] {
  if (!value) return []
  return [...new Set(value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token)))]
}

function overlap(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right)
  return left.filter(item => rightSet.has(item)).length
}

function completenessScore(product: Product): number {
  let score = 0
  if (product.image) score += 4
  if (product.priceCad !== undefined) score += 3
  if (product.brand) score += 1
  if (product.category) score += 2
  if (product.shoppingDepartment) score += 1
  if (product.colors.length) score += 1
  if (product.sizes.length) score += 1
  if (product.description) score += 1
  if (product.stage === 'enriched') score += 2
  return score
}

export function scoreCandidate(product: Product, session: SearchSession, now = Date.now()): number {
  const mission = session.mission
  const target = session.targets.find(candidate => candidate.id === product.targetId)
  const queryTokens = tokens(mission.derivedQueries.join(' '))
  const productTokens = tokens([product.name, product.brand, product.category, product.description].filter(Boolean).join(' '))
  let score = (target?.relevanceScore ?? 0) * 0.35
  score += overlap(queryTokens, productTokens) * 2.5
  const category = product.category
  if (category && mission.needs.some(need => need.categories.includes(category))) score += 9
  if (category && mission.constraints.categories.includes(category)) score += 8
  score += overlap(product.styleTags, mission.stylePreferences) * 5
  score += overlap(product.occasionTags, mission.context.occasions) * 4
  if (product.priceCad !== undefined && mission.constraints.maxPriceCad !== undefined) {
    const ratio = product.priceCad / mission.constraints.maxPriceCad
    score += ratio <= 0.65 ? 7 : ratio <= 0.9 ? 5 : 2
  }
  score += product.availability === 'in-stock' ? 5 : product.availability === 'limited' ? 2 : product.availability === 'out-of-stock' ? -30 : 0
  const observedTime = Date.parse(product.observedAt)
  if (Number.isFinite(observedTime)) {
    const daysOld = Math.max(0, (now - observedTime) / 86_400_000)
    score += Math.max(0, 4 - daysOld / 14)
  }
  score += completenessScore(product)
  return Number(score.toFixed(3))
}

function nearDuplicate(left: Product, right: Product): boolean {
  if (left.category && right.category && left.category !== right.category) return false
  const leftTokens = tokens(left.name)
  const rightTokens = tokens(right.name)
  if (!leftTokens.length || !rightTokens.length) return false
  const shared = overlap(leftTokens, rightTokens)
  const union = new Set([...leftTokens, ...rightTokens]).size
  return shared / union >= 0.6
}

export function rankAndDiversifyProducts(
  products: readonly Product[],
  session: SearchSession,
  now = Date.now(),
): { products: Product[]; rankings: RankingTrace[] } {
  const remaining = products.map(product => ({ product, relevanceScore: scoreCandidate(product, session, now) }))
  const selected: Product[] = []
  const rankings: RankingTrace[] = []
  const retailerCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()

  while (remaining.length) {
    const scored = remaining.map((candidate) => {
      const repetitionPenalty = (retailerCounts.get(candidate.product.retailerId) ?? 0) * 8
      const duplicatePenalty = selected.some(product => nearDuplicate(product, candidate.product)) ? 13 : 0
      const categoryBonus = candidate.product.category && !(categoryCounts.get(candidate.product.category) ?? 0) ? 5 : 0
      const diversityAdjustment = categoryBonus - repetitionPenalty - duplicatePenalty
      return {
        ...candidate,
        diversityAdjustment,
        finalScore: candidate.relevanceScore + diversityAdjustment,
      }
    }).sort((left, right) => right.finalScore - left.finalScore
      || right.relevanceScore - left.relevanceScore
      || left.product.id.localeCompare(right.product.id))
    const winner = scored[0]
    if (!winner) break
    const index = remaining.findIndex(candidate => candidate.product.id === winner.product.id)
    remaining.splice(index, 1)
    const rankedProduct = { ...winner.product, relevanceScore: winner.relevanceScore }
    selected.push(rankedProduct)
    retailerCounts.set(rankedProduct.retailerId, (retailerCounts.get(rankedProduct.retailerId) ?? 0) + 1)
    if (rankedProduct.category) categoryCounts.set(rankedProduct.category, (categoryCounts.get(rankedProduct.category) ?? 0) + 1)
    rankings.push({
      productId: rankedProduct.id,
      relevanceScore: winner.relevanceScore,
      diversityAdjustment: winner.diversityAdjustment,
      finalScore: Number(winner.finalScore.toFixed(3)),
      position: selected.length,
    })
  }

  return { products: selected, rankings }
}
