import { promptStores, scopeBriefNeeds, storeDomain } from '~/domain/search/stores'
import { retailerIdsMentionedIn, RETAILER_BY_ID } from '~/data/retailers'
import { stableHash } from '~/domain/productIdentity'
import { clothesCategories, parseBrief, parseBudget, queriesForItem } from '~/domain/search/briefParser'
import { allocateBudget } from '~/domain/search/priceModel'
import {
  OCCASIONS, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type MissionNeed, type Occasion, type ParsedBrief, type ProductCategory, type SearchMission,
  type SearchMissionInput, type ShoppingDepartment, type StyleId, type StyleProfile, type VisualGuide,
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
  fragrance: ['fragrance', 'fragrances', 'perfume', 'perfumes', 'cologne', 'colognes', 'eau de toilette', 'eau de parfum'],
}

const OCCASION_TERMS: Record<Occasion, string[]> = {
  dinner: ['dinner', 'restaurant'],
  'date-night': ['date night', 'date-night'],
  work: ['work', 'office', 'meeting'],
  casual: ['casual', 'everyday'],
  weekend: ['weekend'],
  party: ['party', 'club'],
  formal: ['formal', 'wedding', 'gala', 'engagement'],
  travel: ['travel', 'flight', 'airport', 'trip'],
  training: ['training', 'gym', 'workout', 'running'],
  vacation: ['vacation', 'getaway', 'holiday trip', 'on holiday'],
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

/** One need per brief item, quantity preserved: "three clothes and a perfume" becomes two needs, not one query. */
function lineItemNeeds(items: ParsedBrief['items'], climate: ParsedBrief['climate'], department: ShoppingDepartment, dinner = false): MissionNeed[] {
  return items.map((item, index) => ({
    id: `need:${stableHash(`${index}:${item.phrase}`)}`,
    intent: item.group === 'clothes' ? 'clothes' : (item.hint ?? item.phrase).replace(/^footwears$/, 'footwear'),
    queries: queriesForItem(item, climate, department, dinner),
    categories: item.group === 'clothes' ? clothesCategories(climate, department) : [...item.categories],
    required: true,
    quantity: item.quantity,
  }))
}

const MAX_GUIDE_COLOURS = 5
const MAX_GUIDE_DESCRIPTORS = 8

function validateVisualGuide(input: VisualGuide | undefined): VisualGuide | undefined {
  if (!input) return undefined
  const guide = {
    inspirationId: input.inspirationId?.trim() || undefined,
    palette: cleanList(input.palette, MAX_GUIDE_COLOURS, 30).map(colour => colour.toLowerCase()),
    descriptors: cleanList(input.descriptors, MAX_GUIDE_DESCRIPTORS, 40).map(descriptor => descriptor.toLowerCase()),
  }
  return guide.inspirationId || guide.palette.length || guide.descriptors.length ? guide : undefined
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
      ...(need.retailerIds !== undefined ? { retailerIds: validRetailerIds(need.retailerIds, true) } : {}),
      ...(need.storeDomains !== undefined ? { storeDomains: need.storeDomains.map(storeDomain) } : {}),
      ...(need.storeNames !== undefined ? { storeNames: cleanList(need.storeNames, 10) } : {}),
    }
  })
}

function validRetailerIds(values: readonly string[] | undefined, strict = false): string[] {
  if (strict && values?.some(id => !RETAILER_BY_ID.has(id))) throw new Error('Unknown retailer ID. Use storeNames for an unfamiliar store or storeDomains for a verified official domain.')
  return [...new Set(values ?? [])].filter(id => RETAILER_BY_ID.has(id))
}

// Shop accepts one or two `like` entries per search; each seed becomes its own similarity target.
export const MAX_MISSION_SEEDS = 2

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

  const inferredOccasions = inferOccasions(rawPrompt)
  const isVacation = inferredOccasions.includes('vacation')
    || /\bvacation\b|\bgetaway\b|\bholiday\s+(?:trip|travel|getaway)\b|\b(?:on|for a)\s+holiday\b/i.test(rawPrompt)
  const brief = parseBrief(rawPrompt)
  // A bare "get my clothes for vacation" keeps the richer vacation plan; counted or named items become line items.
  const useLineItems = !input.needs?.length && brief.items.length > 0
    && (!isVacation || brief.items.some(item => item.explicitQuantity || item.group === 'category'))
  const explicitCategories = [...new Set(input.constraints?.categories ?? (
    input.needs?.length
      ? []
      : useLineItems
        ? brief.items.flatMap(item => item.group === 'clothes' ? clothesCategories(brief.climate, shoppingDepartment as ShoppingDepartment) : item.categories)
        : inferCategories(rawPrompt)
  ))]
  if (!explicitCategories.every(category => categoryIds.has(category))) throw new Error('Mission contains an unsupported category constraint.')
  const suppliedOccasions = [...new Set(input.context?.occasions ?? inferredOccasions)]
  if (!suppliedOccasions.every(occasion => occasionIds.has(occasion))) throw new Error('Mission contains an unsupported occasion.')

  const destination = input.context?.destination?.trim()
    || (/\bcanc[uú]n\b/i.test(rawPrompt) ? 'Cancun' : brief.destination)
  const climateHints = cleanList(input.context?.climateHints, 8)
  if (brief.climate && !climateHints.includes(brief.climate)) climateHints.push(brief.climate)
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
  let plannedNeeds = providedNeeds.length
    ? providedNeeds
    : useLineItems
      ? scopeBriefNeeds(rawPrompt, lineItemNeeds(brief.items, brief.climate, shoppingDepartment as ShoppingDepartment, suppliedOccasions.includes('dinner') || suppliedOccasions.includes('date-night')))
      : isVacation
        ? vacationNeeds(shoppingDepartment as ShoppingDepartment)
        : fallbackNeeds(rawPrompt, explicitCategories)
  // Explicit global store constraints override heuristic clause scoping; explicit per-need input remains authoritative.
  if (!providedNeeds.length && (input.constraints?.retailerIds?.length || input.constraints?.storeDomains?.length || input.constraints?.storeNames?.length)) {
    plannedNeeds = plannedNeeds.map(({ retailerIds: _ids, storeDomains: _domains, storeNames: _names, ...need }) => need)
  }
  const derivedQueries = [...new Set(plannedNeeds.flatMap(need => need.queries))].slice(0, 24)
  if (!derivedQueries.length) throw new Error('Mission must produce at least one concrete search query.')

  const visualGuide = validateVisualGuide(input.context?.visualGuide)
  const mentionedRetailers = retailerIdsMentionedIn(rawPrompt)
  const mentionedStores = promptStores(rawPrompt)
  const storeDomains = [...new Set((input.constraints?.storeDomains ?? mentionedStores.domains).map(storeDomain))]
  const storeNames = cleanList([...(input.constraints?.storeNames ?? mentionedStores.names), ...plannedNeeds.flatMap(need => need.storeNames ?? [])], 10)
  const retailerIds = validRetailerIds(input.constraints?.retailerIds?.length ? input.constraints.retailerIds : mentionedRetailers, Boolean(input.constraints?.retailerIds?.length))
  const excludedRetailerIds = validRetailerIds([
    ...(profile?.excludedRetailerIds ?? []),
    ...(input.constraints?.excludedRetailerIds ?? []),
  ]).filter(id => !retailerIds.includes(id))
  const statedBudget = parseBudget(rawPrompt, plannedNeeds.reduce((sum, need) => sum + need.quantity, 0))
  const overallBudgetCad = input.constraints?.overallBudgetCad
    ?? inferOverallBudgetCad(rawPrompt)
    ?? (statedBudget?.scope === 'total' ? statedBudget.amountCad : undefined)
  // A usual per-item budget never overrides a basket budget the person just stated.
  const maxPriceCad = input.constraints?.maxPriceCad
    ?? (statedBudget?.scope === 'each' ? statedBudget.amountCad : undefined)
    ?? (overallBudgetCad === undefined ? profile?.usualBudgetCad : undefined)
  if (maxPriceCad !== undefined && (!Number.isFinite(maxPriceCad) || maxPriceCad <= 0)) {
    throw new Error('maxPriceCad must be a positive CAD amount.')
  }
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
      ...(visualGuide ? { visualGuide } : {}),
    },
    needs: allocateBudget(plannedNeeds, overallBudgetCad),
    constraints: {
      maxPriceCad,
      overallBudgetCad: overallBudgetCad !== undefined ? Number(overallBudgetCad.toFixed(2)) : undefined,
      categories: explicitCategories,
      retailerIds,
      excludedRetailerIds,
      ...(storeDomains.length ? { storeDomains } : {}),
      ...(storeNames.length ? { storeNames } : {}),
    },
    derivedQueries,
    createdAt: now,
    ...(input.seeds?.length ? { seeds: input.seeds.slice(0, MAX_MISSION_SEEDS).map(seed => ({ ...seed })) } : {}),
  }
}
