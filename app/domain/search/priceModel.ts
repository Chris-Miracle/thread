import type { MissionNeed, ProductCategory } from '~/types/thread'

/**
 * Category price priors in CAD for mid-market fashion (low = typical 10th percentile, typical = median).
 * They only shape budget allocation and search price caps; the basket optimizer always uses observed prices.
 */
export const CATEGORY_PRICE_PRIORS: Record<ProductCategory, { low: number; typical: number }> = {
  tops: { low: 15, typical: 45 },
  bottoms: { low: 20, typical: 55 },
  dresses: { low: 25, typical: 70 },
  outerwear: { low: 40, typical: 130 },
  footwear: { low: 30, typical: 90 },
  accessories: { low: 10, typical: 35 },
  activewear: { low: 20, typical: 55 },
  swimwear: { low: 20, typical: 55 },
  fragrance: { low: 35, typical: 110 },
}

const DEFAULT_PRIOR = { low: 20, typical: 55 }

/** Average prior across the categories a need accepts; mixed apparel needs land between tops and dresses. */
export function needPrior(need: Pick<MissionNeed, 'categories'>): { low: number; typical: number } {
  if (!need.categories.length) return DEFAULT_PRIOR
  const priors = need.categories.map(category => CATEGORY_PRICE_PRIORS[category])
  return {
    low: Math.min(...priors.map(prior => prior.low)),
    typical: priors.reduce((sum, prior) => sum + prior.typical, 0) / priors.length,
  }
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

/**
 * Splits an overall budget across needs in proportion to quantity × typical category price, then derives each
 * item's feasibility ceiling: the overall budget minus the cheapest plausible cost of every other required slot.
 * Needs with a stated budget keep it; only the remainder is allocated.
 */
export function allocateBudget(needs: readonly MissionNeed[], overallBudgetCad: number | undefined): MissionNeed[] {
  if (overallBudgetCad === undefined) return needs.map(need => ({ ...need }))
  const fixed = needs.reduce((sum, need) => sum + (need.budgetCad ?? 0), 0)
  const flexible = needs.filter(need => need.budgetCad === undefined)
  const weight = flexible.reduce((sum, need) => sum + need.quantity * needPrior(need).typical, 0)
  const remaining = Math.max(0, overallBudgetCad - fixed)
  const floorOfAll = needs
    .filter(need => need.required)
    .reduce((sum, need) => sum + need.quantity * needPrior(need).low, 0)
  return needs.map((need) => {
    const allocationCad = need.budgetCad ?? (weight > 0 ? remaining * (need.quantity * needPrior(need).typical) / weight : remaining)
    const ownFloor = need.required ? need.quantity * needPrior(need).low : 0
    const othersFloor = floorOfAll - ownFloor + (need.required ? (need.quantity - 1) * needPrior(need).low : 0)
    const ceiling = Math.max(needPrior(need).low, overallBudgetCad - othersFloor)
    return {
      ...need,
      allocationCad: round(allocationCad),
      priceCeilingCad: round(need.budgetCad !== undefined ? Math.min(need.budgetCad, ceiling) : ceiling),
    }
  })
}

/** Shop price cap for one item: generous headroom over its allocation, never above the feasibility ceiling. */
export function searchPriceCapCad(need: MissionNeed, maxPriceCad?: number): number | undefined {
  const caps = [maxPriceCad, need.priceCeilingCad, need.budgetCad]
  if (need.allocationCad !== undefined) caps.push((need.allocationCad / need.quantity) * 2)
  const defined = caps.filter((value): value is number => value !== undefined && value > 0)
  return defined.length ? round(Math.min(...defined)) : undefined
}
