import { retailerIdsMentionedIn, RETAILER_BY_ID } from '~/data/retailers'
import { stableHash } from '~/domain/productIdentity'
import {
  OCCASIONS, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type MissionNeed, type Occasion, type ProductCategory, type SearchMission,
  type SearchMissionInput, type ShoppingDepartment, type StyleId, type StyleProfile,
} from '~/types/thread'

const departmentIds = new Set<string>(SHOPPING_DEPARTMENTS.map(item => item.id))
const styleIds = new Set<string>(STYLE_OPTIONS.map(item => item.id))
const categoryIds = new Set<string>(PRODUCT_CATEGORIES)
const occasionIds = new Set<string>(OCCASIONS)

const CATEGORY_TERMS: Record<ProductCategory, string[]> = {
  tops: ['shirt', 'shirts', 'top', 'tops', 'tee', 't-shirt', 'polo', 'blouse', 'sweater', 'cardigan', 'vest'],
  bottoms: ['pants', 'trousers', 'jeans', 'shorts', 'skirt', 'bottoms', 'chinos', 'cargo'],
  dresses: ['dress', 'dresses', 'mini dress', 'midi dress', 'maxi dress'],
  outerwear: ['jacket', 'coat', 'outerwear', 'blazer', 'trench', 'parka'],
  footwear: ['shoes', 'shoe', 'sneakers', 'sandals', 'loafers', 'heels', 'boots', 'footwear'],
  accessories: ['accessories', 'accessory', 'bag', 'belt', 'sunglasses', 'hat', 'cap', 'jewelry'],
  activewear: ['activewear', 'workout', 'gym', 'training', 'leggings', 'running'],
  swimwear: ['swimwear', 'swimsuit', 'bikini', 'swim shorts', 'swim trunks'],
  fragrance: ['fragrance', 'fragrances', 'perfume', 'cologne', 'eau de toilette', 'eau de parfum'],
}

const OCCASION_TERMS: Record<Occasion, string[]> = {
  dinner: ['dinner', 'restaurant'],
  'date-night': ['date night', 'date-night'],
  work: ['work', 'office', 'meeting'],
  casual: ['casual', 'everyday'],
  weekend: ['weekend'],
  party: ['party', 'club'],
  formal: ['formal', 'wedding', 'gala'],
  travel: ['travel', 'flight', 'airport', 'trip'],
  training: ['training', 'gym', 'workout', 'running'],
  vacation: ['vacation', 'holiday', 'getaway'],
  beach: ['beach', 'pool'],
  resort: ['resort'],
}

function cleanRequired(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function cleanList(values: readonly string[] | undefined, maxItems: number, maxLength = 80): string[] {
  if (!values) return []
  return [...new Set(values.map(value => value.trim().replace(/\s+/g, ' ').slice(0, maxLength)).filter(Boolean))].slice(0, maxItems)
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9$.-]+/g, ' ').trim()
}

export function inferMaxPriceCad(rawPrompt: string): number | undefined {
  const match = normalized(rawPrompt).match(/(?:under|below|less than|max|maximum|up to)\s*(?:cad\s*)?\$?\s*(\d+(?:\.\d+)?)(?:\s*cad)?/)
  if (!match?.[1]) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export function inferOverallBudgetCad(rawPrompt: string): number | undefined {
  const match = normalized(rawPrompt).match(/(?:total|overall|all in|altogether)(?:\s+(?:budget|of|is))?\s*(?:cad\s*)?\$?\s*(\d+(?:\.\d+)?)(?:\s*cad)?/)
  if (!match?.[1]) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function inferCategories(rawPrompt: string): ProductCategory[] {
  const value = ` ${normalized(rawPrompt)} `
  return (Object.entries(CATEGORY_TERMS) as Array<[ProductCategory, string[]]>)
    .filter(([, terms]) => terms.some(term => value.includes(` ${normalized(term)} `)))
    .map(([category]) => category)
}

function inferOccasions(rawPrompt: string): Occasion[] {
  const value = ` ${normalized(rawPrompt)} `
  return (Object.entries(OCCASION_TERMS) as Array<[Occasion, string[]]>)
    .filter(([, terms]) => terms.some(term => value.includes(` ${normalized(term)} `)))
    .map(([occasion]) => occasion)
}

function vacationNeeds(department: ShoppingDepartment): MissionNeed[] {
  const daytime = department === 'men'
    ? ['linen shirt', 'camp collar shirt', 'relaxed shorts']
    : department === 'women'
      ? ['linen dress', 'breathable top', 'relaxed shorts']
      : ['linen shirt', 'breathable top', 'relaxed shorts']
  const beach = department === 'men' ? ['swim shorts', 'leather sandals'] : department === 'women' ? ['swimsuit', 'beach cover up', 'sandals'] : ['swimwear', 'beach cover up', 'sandals']
  const evening = department === 'men' ? ['linen trousers', 'knit polo', 'camp collar shirt'] : department === 'women' ? ['resort dinner dress', 'linen trousers', 'evening top'] : ['linen trousers', 'knit polo', 'resort dinner outfit']
  return [
    { id: 'need:resort-daytime', intent: 'resort daytime', queries: daytime, categories: ['tops', 'bottoms', 'dresses'], required: true, quantity: 1 },
    { id: 'need:beach', intent: 'beach and pool', queries: beach, categories: ['swimwear', 'footwear', 'accessories'], required: false, quantity: 1 },
    { id: 'need:evening-dinner', intent: 'evening dinner', queries: evening, categories: ['tops', 'bottoms', 'dresses'], required: true, quantity: 1 },
  ]
}

function fallbackNeeds(rawPrompt: string, categories: ProductCategory[]): MissionNeed[] {
  const query = cleanRequired(rawPrompt, 'rawPrompt', 180)
    .replace(/^(?:please\s+)?(?:find(?: me)?|get(?: me)?|shop for|show me)\s+/i, '')
  return [{
    id: `need:${stableHash(query)}`,
    intent: categories.length ? categories.join(' and ') : 'requested clothing',
    queries: [query],
    categories,
    required: true,
    quantity: 1,
  }]
}

function validateNeeds(input: SearchMissionInput['needs']): MissionNeed[] {
  if (!input?.length) return []
  if (input.length > 12) throw new Error('A mission may contain at most 12 needs.')
  return input.map((need, index) => {
    const intent = cleanRequired(need.intent, `needs[${index}].intent`, 100)
    const queries = cleanList(need.queries, 10, 120)
    if (!queries.length) throw new Error(`needs[${index}].queries must contain at least one concrete retailer query.`)
    const categories = [...new Set(need.categories ?? [])]
    if (!categories.every(category => categoryIds.has(category))) throw new Error(`needs[${index}] contains an unsupported category.`)
    const quantity = need.quantity ?? 1
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error(`needs[${index}].quantity must be between 1 and 20.`)
    const budgetCad = need.budgetCad
    if (budgetCad !== undefined && (!Number.isFinite(budgetCad) || budgetCad <= 0)) {
      throw new Error(`needs[${index}].budgetCad must be a positive CAD amount.`)
    }
    return {
      id: `need:${stableHash(`${index}:${intent}`)}`,
      intent,
      queries,
      categories,
      required: need.required ?? true,
      quantity,
      budgetCad: budgetCad !== undefined ? Number(budgetCad.toFixed(2)) : undefined,
    }
  })
}

function validRetailerIds(values: readonly string[] | undefined): string[] {
  return [...new Set(values ?? [])].filter(id => RETAILER_BY_ID.has(id))
}

export function createSearchMission(
  input: SearchMissionInput,
  profile: StyleProfile | null,
  now = new Date().toISOString(),
): SearchMission {
  const rawPrompt = cleanRequired(input.rawPrompt, 'rawPrompt')
  const shoppingDepartment = input.shoppingDepartment ?? profile?.shoppingDepartment ?? 'all'
  if (!departmentIds.has(shoppingDepartment)) throw new Error('Unsupported shopping department.')
  const stylePreferences = [...new Set(input.stylePreferences ?? profile?.styles ?? [])]
  if (!stylePreferences.every(style => styleIds.has(style))) throw new Error('Mission contains an unsupported style preference.')

  const explicitCategories = [...new Set(input.constraints?.categories ?? (input.needs?.length ? [] : inferCategories(rawPrompt)))]
  if (!explicitCategories.every(category => categoryIds.has(category))) throw new Error('Mission contains an unsupported category constraint.')
  const inferredOccasions = inferOccasions(rawPrompt)
  const isVacation = inferredOccasions.includes('vacation') || /\bvacation\b|\bholiday\b|\bgetaway\b/i.test(rawPrompt)
  const suppliedOccasions = [...new Set(input.context?.occasions ?? inferredOccasions)]
  if (!suppliedOccasions.every(occasion => occasionIds.has(occasion))) throw new Error('Mission contains an unsupported occasion.')

  const destination = input.context?.destination?.trim()
    || (/\bcanc[uú]n\b/i.test(rawPrompt) ? 'Cancun' : undefined)
  const climateHints = cleanList(input.context?.climateHints, 8)
  if (destination?.toLowerCase() === 'cancun') {
    for (const hint of ['hot', 'humid', 'tropical']) {
      if (!climateHints.includes(hint)) climateHints.push(hint)
    }
  }
  if (isVacation) {
    for (const occasion of ['vacation', 'travel', 'resort'] as Occasion[]) {
      if (!suppliedOccasions.includes(occasion)) suppliedOccasions.push(occasion)
    }
  }

  const providedNeeds = validateNeeds(input.needs)
  const needs = providedNeeds.length
    ? providedNeeds
    : isVacation
      ? vacationNeeds(shoppingDepartment)
      : fallbackNeeds(rawPrompt, explicitCategories)
  const derivedQueries = [...new Set(needs.flatMap(need => need.queries))].slice(0, 24)
  if (!derivedQueries.length) throw new Error('Mission must produce at least one concrete search query.')

  const mentionedRetailers = retailerIdsMentionedIn(rawPrompt)
  const retailerIds = validRetailerIds(input.constraints?.retailerIds?.length ? input.constraints.retailerIds : mentionedRetailers)
  const excludedRetailerIds = validRetailerIds([
    ...(profile?.excludedRetailerIds ?? []),
    ...(input.constraints?.excludedRetailerIds ?? []),
  ]).filter(id => !retailerIds.includes(id))
  const maxPriceCad = input.constraints?.maxPriceCad ?? inferMaxPriceCad(rawPrompt) ?? profile?.usualBudgetCad
  if (maxPriceCad !== undefined && (!Number.isFinite(maxPriceCad) || maxPriceCad <= 0)) {
    throw new Error('maxPriceCad must be a positive CAD amount.')
  }
  const overallBudgetCad = input.constraints?.overallBudgetCad ?? inferOverallBudgetCad(rawPrompt)
  if (overallBudgetCad !== undefined && (!Number.isFinite(overallBudgetCad) || overallBudgetCad <= 0)) {
    throw new Error('overallBudgetCad must be a positive CAD amount.')
  }

  return {
    version: 1,
    rawPrompt,
    shoppingDepartment: shoppingDepartment as ShoppingDepartment,
    stylePreferences: stylePreferences as StyleId[],
    context: {
      tripType: input.context?.tripType?.trim() || (isVacation ? 'vacation' : undefined),
      destination,
      climateHints,
      occasions: suppliedOccasions,
      notes: input.context?.notes?.trim().slice(0, 300) || undefined,
    },
    needs,
    constraints: {
      maxPriceCad,
      overallBudgetCad: overallBudgetCad !== undefined ? Number(overallBudgetCad.toFixed(2)) : undefined,
      categories: explicitCategories,
      retailerIds,
      excludedRetailerIds,
    },
    derivedQueries,
    createdAt: now,
  }
}
