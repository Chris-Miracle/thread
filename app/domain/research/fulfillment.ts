import type {
  MissionNeed, Product, ProductCategory, ResearchTarget, SearchFulfillment, SearchMission,
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

function usableProducts(products: readonly Product[], need: MissionNeed): Product[] {
  return products
    .filter(product => product.needIds.includes(need.id))
    .filter(product => product.availability !== 'out-of-stock')
    .toSorted((left, right) => {
      const leftPrice = left.priceCad ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceCad ?? Number.POSITIVE_INFINITY
      return leftPrice - rightPrice || right.relevanceScore - left.relevanceScore || left.id.localeCompare(right.id)
    })
}

export function evaluateMissionFulfillment(
  mission: SearchMission,
  products: readonly Product[],
): SearchFulfillment {
  const selected = new Set<string>()
  const orderedNeeds = mission.needs
    .map((need, index) => ({ need, index, candidates: usableProducts(products, need) }))
    .toSorted((left, right) => Number(right.need.required) - Number(left.need.required)
      || left.candidates.length - right.candidates.length
      || left.index - right.index)
  const fulfillmentByNeed = new Map<string, SearchFulfillment['needs'][number]>()

  for (const { need, candidates } of orderedNeeds) {
    const selectedForNeed: Product[] = []
    let subtotalCad = 0
    for (const product of candidates) {
      if (selected.has(product.id) || product.priceCad === undefined) continue
      if (selectedForNeed.length >= need.quantity) break
      if (need.budgetCad !== undefined && subtotalCad + product.priceCad > need.budgetCad) continue
      selectedForNeed.push(product)
      selected.add(product.id)
      subtotalCad += product.priceCad
    }
    fulfillmentByNeed.set(need.id, {
      needId: need.id,
      intent: need.intent,
      required: need.required,
      requiredQuantity: need.quantity,
      matchedProductIds: candidates.map(product => product.id),
      selectedProductIds: selectedForNeed.map(product => product.id),
      subtotalCad: Number(subtotalCad.toFixed(2)),
      budgetCad: need.budgetCad,
      satisfied: selectedForNeed.length >= need.quantity,
    })
  }

  const needs = mission.needs.map(need => fulfillmentByNeed.get(need.id)!)
  const requiredNeeds = needs.filter(need => need.required)
  const requiredProductIds = new Set(requiredNeeds.flatMap(need => need.selectedProductIds))
  const subtotalCad = products
    .filter(product => requiredProductIds.has(product.id))
    .reduce((total, product) => total + (product.priceCad ?? 0), 0)
  const withinOverallBudget = mission.constraints.overallBudgetCad === undefined
    || subtotalCad <= mission.constraints.overallBudgetCad

  return {
    needs,
    selectedProductIds: [...requiredProductIds],
    subtotalCad: Number(subtotalCad.toFixed(2)),
    overallBudgetCad: mission.constraints.overallBudgetCad,
    satisfied: requiredNeeds.every(need => need.satisfied) && withinOverallBudget,
  }
}
