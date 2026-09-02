import type { createThreadActions } from '~/domain/threadActions'
import {
  OCCASIONS, PRODUCT_CATEGORIES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type Occasion, type ProductCategory, type SearchMissionInput, type ShoppingDepartment, type StyleId,
} from '~/types/thread'
import { optionalBoolean, optionalNumber, optionalRecord, optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

function parseMission(input: Record<string, unknown>): SearchMissionInput {
  const context = optionalRecord(input, 'context')
  const constraints = optionalRecord(input, 'constraints')
  const rawNeeds = input.needs
  let needs: SearchMissionInput['needs']
  if (rawNeeds !== undefined) {
    if (!Array.isArray(rawNeeds)) throw new Error('needs must be an array.')
    needs = rawNeeds.map((value, index) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`needs[${index}] must be an object.`)
      const need = value as Record<string, unknown>
      return {
        intent: requiredString(need, 'intent'),
        queries: optionalStringArray(need, 'queries') ?? [],
        categories: optionalStringArray(need, 'categories') as ProductCategory[] | undefined,
        required: optionalBoolean(need, 'required'),
        quantity: optionalNumber(need, 'quantity'),
        budgetCad: optionalNumber(need, 'budgetCad'),
      }
    })
  }
  return {
    rawPrompt: requiredString(input, 'rawPrompt'),
    shoppingDepartment: optionalString(input, 'shoppingDepartment') as ShoppingDepartment | undefined,
    stylePreferences: optionalStringArray(input, 'stylePreferences') as StyleId[] | undefined,
    context: context ? {
      tripType: optionalString(context, 'tripType'),
      destination: optionalString(context, 'destination'),
      climateHints: optionalStringArray(context, 'climateHints'),
      occasions: optionalStringArray(context, 'occasions') as Occasion[] | undefined,
      notes: optionalString(context, 'notes'),
    } : undefined,
    needs,
    constraints: constraints ? {
      maxPriceCad: optionalNumber(constraints, 'maxPriceCad'),
      overallBudgetCad: optionalNumber(constraints, 'overallBudgetCad'),
      categories: optionalStringArray(constraints, 'categories') as ProductCategory[] | undefined,
      retailerIds: optionalStringArray(constraints, 'retailerIds'),
      excludedRetailerIds: optionalStringArray(constraints, 'excludedRetailerIds'),
    } : undefined,
  }
}

export function startShoppingSearchTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'start_shopping_search',
    title: 'Start a shopping mission',
    description: 'The one entry point for a new shopping request. Translate the user’s goal into optional structured context and concrete needs; Rove validates it, ranks every eligible retailer, persists the session, and creates the research queue.',
    inputSchema: {
      type: 'object',
      properties: {
        rawPrompt: { type: 'string', description: 'The user’s original shopping request.' },
        shoppingDepartment: { type: 'string', enum: SHOPPING_DEPARTMENTS.map(option => option.id) },
        stylePreferences: { type: 'array', items: { type: 'string', enum: STYLE_OPTIONS.map(option => option.id) }, maxItems: 10 },
        context: {
          type: 'object',
          properties: {
            tripType: { type: 'string' },
            destination: { type: 'string' },
            climateHints: { type: 'array', items: { type: 'string' }, maxItems: 8 },
            occasions: { type: 'array', items: { type: 'string', enum: OCCASIONS }, maxItems: 12 },
            notes: { type: 'string' },
          },
          additionalProperties: false,
        },
        needs: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              intent: { type: 'string' },
              queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
              categories: { type: 'array', items: { type: 'string', enum: PRODUCT_CATEGORIES }, maxItems: PRODUCT_CATEGORIES.length },
              required: { type: 'boolean' },
              quantity: { type: 'number', minimum: 1, maximum: 20, description: 'How many distinct products must fulfill this need. Defaults to 1.' },
              budgetCad: { type: 'number', minimum: 0.01, description: 'Maximum combined CAD subtotal for products selected for this need.' },
            },
            required: ['intent', 'queries'],
            additionalProperties: false,
          },
        },
        constraints: {
          type: 'object',
          properties: {
            maxPriceCad: { type: 'number', minimum: 0.01 },
            overallBudgetCad: { type: 'number', minimum: 0.01, description: 'Maximum CAD subtotal for the proposed products across all required needs.' },
            categories: { type: 'array', items: { type: 'string', enum: PRODUCT_CATEGORIES }, maxItems: PRODUCT_CATEGORIES.length },
            retailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40 },
            excludedRetailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40 },
          },
          additionalProperties: false,
        },
      },
      required: ['rawPrompt'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      return actions.startShoppingSearch(parseMission(input))
    },
  }
}
