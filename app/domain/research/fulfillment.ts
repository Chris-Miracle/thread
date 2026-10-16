import { isDressyMission, nearDuplicate } from '~/domain/products/productRanking'
import type {
  MissionNeed, NeedFulfillment, Product, ProductCategory, ResearchTarget, SearchFulfillment, SearchMission,
} from '~/types/thread'

function supportsCategory(need: MissionNeed, category: ProductCategory | undefined): boolean {
  return Boolean(category && need.categories.includes(category))
}

export function resolveCandidateNeedIds(
  explicitNeedIds: readonly string[] | undefined,
  category: ProductCategory | undefined,
  mission: SearchMission,
  target: ResearchTarget,
): string[] {
  const supported = new Set(target.needIds)
  if (explicitNeedIds?.length) {
    const unique = [...new Set(explicitNeedIds)]
    if (!unique.every(needId => supported.has(needId))) {
      throw new Error('Candidate needIds must belong to needs supported by this research target.')
    }
    if (category && !unique.every((needId) => {
      const need = mission.needs.find(candidate => candidate.id === needId)
      return need && (!need.categories.length || need.categories.includes(category))
    })) {
      throw new Error('Candidate category does not match its assigned mission need.')
    }
    return unique
  }
  const categoryMatches = mission.needs
    .filter(need => supported.has(need.id) && supportsCategory(need, category))
    .map(need => need.id)
  if (categoryMatches.length) return categoryMatches
  return target.needIds.length === 1 ? [...target.needIds] : []
}

/** Alternatives beyond the requested quantity before a need counts as a real choice. */
export const MIN_ALTERNATIVES_PER_NEED = 2
/** Candidates per need the optimizer considers, best utility first. */
const CANDIDATES_PER_NEED = 30
/** Budget resolution for the knapsack; costs round up, so a chosen basket never exceeds the real budget. */
const BUDGET_CELLS = 600
/** Utility lost per allocation-share of spend: prefers value without forcing the cheapest item. */
const VALUE_WEIGHT = 4
/** Utility lost per allocation-share left unspent on a dressy mission, so a $25 perfume does not beat a fitting one. */
const UNDERSPEND_WEIGHT = 8
const DUPLICATE_PENALTY = 12
const CATEGORY_REPEAT_PENALTY = 4
const RETAILER_REPEAT_PENALTY = 1.5
const MAX_SWAP_ROUNDS = 100

interface Candidate {
  product: Product
  price: number
  utility: number
}

interface NeedPool {
  need: MissionNeed
  candidates: Candidate[]
  /** Every priced, available match, used for depth and traceability. */
  matched: Product[]
}

function usable(product: Product, need: MissionNeed): boolean {
  return product.needIds.includes(need.id) && product.availability !== 'out-of-stock'
}

function utilityFor(product: Product, need: MissionNeed, dressy: boolean): number {
  const relevance = Math.max(0, product.relevanceScore)
  const share = need.allocationCad !== undefined ? need.allocationCad / need.quantity : undefined
  if (!share || product.priceCad === undefined) return relevance
  const ratio = product.priceCad / share
  if (!dressy) return relevance - VALUE_WEIGHT * ratio
  // Spending close to the share is the goal; going over still crowds out other needs at the usual rate.
  return relevance - VALUE_WEIGHT * Math.max(0, ratio - 1) - UNDERSPEND_WEIGHT * Math.max(0, 1 - ratio)
}

/**
 * Each product fills at most one slot: products matching several needs go to the need with the fewest
 * alternatives, so a scarce need is never starved by a plentiful one.
 */
function buildPools(mission: SearchMission, products: readonly Product[]): NeedPool[] {
  const dressy = isDressyMission(mission)
  const matchCounts = new Map(mission.needs.map(need => [need.id, products.filter(product => usable(product, need)).length]))
  const primaryNeed = new Map<string, string>()
  for (const product of products) {
    const eligible = mission.needs.filter(need => usable(product, need))
    const primary = eligible.toSorted((left, right) => (matchCounts.get(left.id)! - matchCounts.get(right.id)!)
      || mission.needs.indexOf(left) - mission.needs.indexOf(right))[0]
    if (primary) primaryNeed.set(product.id, primary.id)
  }
  return mission.needs.map(need => ({
    need,
    matched: products.filter(product => usable(product, need) && product.priceCad !== undefined),
    candidates: products
      .filter(product => primaryNeed.get(product.id) === need.id && product.priceCad !== undefined)
      .map(product => ({ product, price: product.priceCad!, utility: utilityFor(product, need, dressy) }))
      .toSorted((left, right) => right.utility - left.utility || left.price - right.price || left.product.id.localeCompare(right.product.id))
      .slice(0, CANDIDATES_PER_NEED),
  }))
}

/** 0/1 knapsack with an item count: best[count][cells] is the highest utility for that many picks within that cost. */
function solveNeed(pool: NeedPool, cells: number, unit: number) {
  const quantity = pool.need.quantity
  const capCells = pool.need.budgetCad !== undefined ? Math.min(cells, Math.floor(pool.need.budgetCad / unit + 1e-9)) : cells
  const costs = pool.candidates.map(candidate => Math.ceil(candidate.price / unit - 1e-9))
  const best = Array.from({ length: quantity + 1 }, (_, count) => new Float64Array(cells + 1).fill(count === 0 ? 0 : Number.NEGATIVE_INFINITY))
  const taken: Uint8Array[][] = []
  pool.candidates.forEach((candidate, index) => {
    const cost = costs[index]!
    const layer: Uint8Array[] = []
    for (let count = quantity; count >= 1; count -= 1) {
      const row = new Uint8Array(cells + 1)
      for (let spend = capCells; spend >= cost; spend -= 1) {
        const value = best[count - 1]![spend - cost]! + candidate.utility
        if (value > best[count]![spend]!) {
          best[count]![spend] = value
          row[spend] = 1
        }
      }
      layer[count] = row
    }
    taken.push(layer)
  })
  // best[c][w] holds "exact cost w"; make it monotone so it reads "cost at most w".
  for (let count = 1; count <= quantity; count += 1) {
    for (let spend = 1; spend <= cells; spend += 1) {
      if (best[count]![spend - 1]! > best[count]![spend]!) best[count]![spend] = best[count]![spend - 1]!
    }
  }
  function reconstruct(count: number, spend: number): Candidate[] {
    // Walk back to the exact spend that produced this value, then replay the take decisions.
    let exact = spend
    while (exact > 0 && best[count]![exact - 1] === best[count]![exact]) exact -= 1
    const chosen: Candidate[] = []
    let remainingCount = count
    let remainingSpend = exact
    for (let index = pool.candidates.length - 1; index >= 0 && remainingCount > 0; index -= 1) {
      if (taken[index]![remainingCount]?.[remainingSpend]) {
        chosen.push(pool.candidates[index]!)
        remainingSpend -= costs[index]!
        remainingCount -= 1
      }
    }
    return remainingCount === 0 ? chosen.reverse() : []
  }
  return { best, reconstruct, costs }
}

function basketObjective(selection: ReadonlyMap<string, Candidate[]>, needs: readonly MissionNeed[]): number {
  let score = 0
  for (const need of needs) {
    const picks = selection.get(need.id) ?? []
    score += picks.reduce((sum, pick) => sum + pick.utility, 0)
    const categories = new Map<string, number>()
    picks.forEach((pick, index) => {
      for (const other of picks.slice(index + 1)) {
        if (nearDuplicate(pick.product, other.product)) score -= DUPLICATE_PENALTY
      }
      if (pick.product.category) categories.set(pick.product.category, (categories.get(pick.product.category) ?? 0) + 1)
    })
    // "Three clothes" should read as an outfit, not three of the same top.
    if (need.categories.length > 1) {
      for (const count of categories.values()) score -= Math.max(0, count - 1) * CATEGORY_REPEAT_PENALTY
    }
  }
  const retailers = new Map<string, number>()
  for (const pick of [...selection.values()].flat()) retailers.set(pick.product.retailerId, (retailers.get(pick.product.retailerId) ?? 0) + 1)
  for (const count of retailers.values()) score -= Math.max(0, count - 1) * RETAILER_REPEAT_PENALTY
  return score
}

function totalPrice(selection: ReadonlyMap<string, Candidate[]>): number {
  return [...selection.values()].flat().reduce((sum, pick) => sum + pick.price, 0)
}

/** Single-swap hill climbing on the full objective, which adds variety the knapsack cannot see. */
function improveVariety(selection: Map<string, Candidate[]>, pools: readonly NeedPool[], overallBudgetCad?: number): void {
  const needs = pools.map(pool => pool.need)
  let current = basketObjective(selection, needs)
  for (let round = 0; round < MAX_SWAP_ROUNDS; round += 1) {
    let improved = false
    for (const pool of pools) {
      const picks = selection.get(pool.need.id) ?? []
      const chosenIds = new Set(picks.map(pick => pick.product.id))
      for (let slot = 0; slot < picks.length && !improved; slot += 1) {
        for (const alternative of pool.candidates) {
          if (chosenIds.has(alternative.product.id)) continue
          const swapped = picks.map((pick, index) => index === slot ? alternative : pick)
          const trial = new Map(selection).set(pool.need.id, swapped)
          if (overallBudgetCad !== undefined && totalPrice(trial) > overallBudgetCad + 1e-9) continue
          if (pool.need.budgetCad !== undefined && swapped.reduce((sum, pick) => sum + pick.price, 0) > pool.need.budgetCad + 1e-9) continue
          const score = basketObjective(trial, needs)
          if (score > current + 1e-9) {
            selection.set(pool.need.id, swapped)
            current = score
            improved = true
            break
          }
        }
      }
      if (improved) break
    }
    if (!improved) return
  }
}

/** Best feasible full basket under the overall budget, or null when none exists yet. */
function optimizeWithBudget(pools: readonly NeedPool[], overallBudgetCad: number): Map<string, Candidate[]> | null {
  const cells = Math.max(1, Math.min(BUDGET_CELLS, Math.ceil(overallBudgetCad)))
  const unit = overallBudgetCad / cells
  const solved = pools.map(pool => solveNeed(pool, cells, unit))
  // Each need offers a value curve over spend: required needs must take exactly `quantity`, optional ones may take fewer.
  const curves = pools.map((pool, index) => {
    const { best } = solved[index]!
    const curve = new Float64Array(cells + 1)
    const counts = new Int16Array(cells + 1)
    for (let spend = 0; spend <= cells; spend += 1) {
      if (pool.need.required) {
        curve[spend] = best[pool.need.quantity]![spend]!
        counts[spend] = pool.need.quantity
      } else {
        let value = Number.NEGATIVE_INFINITY
        for (let count = 0; count <= pool.need.quantity; count += 1) {
          if (best[count]![spend]! > value) {
            value = best[count]![spend]!
            counts[spend] = count
          }
        }
        curve[spend] = value
      }
    }
    return { curve, counts }
  })
  let combined = new Float64Array(cells + 1)
  const splits: Int32Array[] = []
  for (const { curve } of curves) {
    const next = new Float64Array(cells + 1).fill(Number.NEGATIVE_INFINITY)
    const split = new Int32Array(cells + 1)
    for (let spend = 0; spend <= cells; spend += 1) {
      for (let own = 0; own <= spend; own += 1) {
        const value = combined[spend - own]! + curve[own]!
        if (value > next[spend]!) {
          next[spend] = value
          split[spend] = own
        }
      }
    }
    combined = next
    splits.push(split)
  }
  if (!Number.isFinite(combined[cells]!)) return null
  const selection = new Map<string, Candidate[]>()
  let spend = cells
  for (let index = pools.length - 1; index >= 0; index -= 1) {
    const own = splits[index]![spend]!
    const count = curves[index]!.counts[own]!
    selection.set(pools[index]!.need.id, count ? solved[index]!.reconstruct(count, own) : [])
    spend -= own
  }
  return selection
}

/** Without an overall budget, needs are independent; a stated per-need budget still binds. */
function optimizeIndependently(pools: readonly NeedPool[]): Map<string, Candidate[]> {
  const selection = new Map<string, Candidate[]>()
  for (const pool of pools) {
    if (pool.need.budgetCad === undefined) {
      selection.set(pool.need.id, pool.candidates.slice(0, pool.need.quantity))
      continue
    }
    const cells = Math.max(1, Math.min(BUDGET_CELLS, Math.ceil(pool.need.budgetCad)))
    const { best, reconstruct } = solveNeed(pool, cells, pool.need.budgetCad / cells)
    let count = Math.min(pool.need.quantity, pool.candidates.length)
    while (count > 0 && !Number.isFinite(best[count]![cells]!)) count -= 1
    selection.set(pool.need.id, count ? reconstruct(count, cells) : [])
  }
  return selection
}

/**
 * Chooses the mission basket: exactly the requested quantity per required need, within every per-need budget and
 * the overall budget, maximizing relevance-and-value utility, then refined for variety. Prices are observed CAD
 * only; unpriced or out-of-stock products are never selected.
 */
export function evaluateMissionFulfillment(
  mission: SearchMission,
  products: readonly Product[],
): SearchFulfillment {
  const pools = buildPools(mission, products)
  const overallBudgetCad = mission.constraints.overallBudgetCad
  const fullBasket = overallBudgetCad !== undefined ? optimizeWithBudget(pools, overallBudgetCad) : null
  // When no full basket fits the budget yet, the best per-need picks keep progress visible; the mission stays unsatisfied.
  const selection = fullBasket ?? optimizeIndependently(pools)
  if (fullBasket || overallBudgetCad === undefined) improveVariety(selection, pools, overallBudgetCad)

  const needs: NeedFulfillment[] = pools.map((pool) => {
    const picks = selection.get(pool.need.id) ?? []
    return {
      needId: pool.need.id,
      intent: pool.need.intent,
      required: pool.need.required,
      requiredQuantity: pool.need.quantity,
      matchedProductIds: pool.matched.map(product => product.id),
      selectedProductIds: picks.map(pick => pick.product.id),
      subtotalCad: Number(picks.reduce((sum, pick) => sum + pick.price, 0).toFixed(2)),
      budgetCad: pool.need.budgetCad,
      satisfied: picks.length >= pool.need.quantity,
      deep: pool.matched.length >= pool.need.quantity + MIN_ALTERNATIVES_PER_NEED,
    }
  })
  const requiredNeeds = needs.filter(need => need.required)
  const selectedProductIds = needs.flatMap(need => need.selectedProductIds)
  const subtotalCad = Number(totalPrice(selection).toFixed(2))
  const withinOverallBudget = overallBudgetCad === undefined || subtotalCad <= overallBudgetCad
  const satisfied = requiredNeeds.every(need => need.satisfied) && withinOverallBudget
  return {
    needs,
    selectedProductIds,
    subtotalCad,
    overallBudgetCad,
    satisfied,
    ready: satisfied && requiredNeeds.every(need => need.deep),
    basketScore: Number(basketObjective(selection, mission.needs).toFixed(3)),
  }
}
