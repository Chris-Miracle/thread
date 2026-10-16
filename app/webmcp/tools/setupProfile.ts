import type { createThreadActions } from '~/domain/threadActions'
import { MAX_PROFILE_STYLES, MIN_PROFILE_STYLES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS } from '~/types/thread'
import { optionalBoolean, optionalNumber, optionalRecord, optionalString, optionalStringArray, requiredString } from '~/webmcp/toolInput'
import type { JSONSchemaNode, WebMCPToolDefinition } from '~/webmcp/types'

type ThreadActions = ReturnType<typeof createThreadActions>

export const optionalProfileProperties: Record<string, JSONSchemaNode> = {
  shoppingDepartment: { type: 'string', enum: SHOPPING_DEPARTMENTS.map(option => option.id), description: 'Department to prioritize.' },
  styles: { type: 'array', items: { type: 'string', enum: STYLE_OPTIONS.map(option => option.id) }, minItems: MIN_PROFILE_STYLES, maxItems: MAX_PROFILE_STYLES },
  genderIdentity: { type: 'string', description: 'Optional self-described gender identity. Store only when explicitly supplied by the user.' },
  racialIdentity: { type: 'string', description: 'Optional self-described racial or cultural identity. It is preserved but never used to infer skin tone.' },
  heightCm: { type: 'number', minimum: 80, maximum: 250 },
  weightKg: { type: 'number', minimum: 20, maximum: 400 },
  clothingSizes: {
    type: 'object',
    properties: {
      tops: { type: 'string' },
      bottoms: { type: 'string' },
      dresses: { type: 'string' },
      outerwear: { type: 'string' },
    },
    additionalProperties: false,
  },
  shoeSize: { type: 'string' },
  preferredFit: { type: 'string' },
  preferredColours: { type: 'array', items: { type: 'string' }, maxItems: 20 },
  avoidedColours: { type: 'array', items: { type: 'string' }, maxItems: 20 },
  usualBudgetCad: { type: 'number', minimum: 0.01 },
  preferredRetailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40 },
  excludedRetailerIds: { type: 'array', items: { type: 'string' }, maxItems: 40 },
  destination: {
    type: 'object',
    description: 'Coarse delivery locality for Shop search context, e.g. from Shop get_account. Country and region only; never store a street address or postal code.',
    properties: {
      country: { type: 'string', description: 'ISO 3166-1 alpha-2, e.g. CA.' },
      region: { type: 'string', description: 'Province or state, e.g. ON.' },
    },
    required: ['country'],
    additionalProperties: false,
  },
}

export function parseProfileFields(input: Record<string, unknown>) {
  const clothingSizes = optionalRecord(input, 'clothingSizes')
  const destination = optionalRecord(input, 'destination')
  return {
    shoppingDepartment: optionalString(input, 'shoppingDepartment'),
    styles: optionalStringArray(input, 'styles'),
    genderIdentity: optionalString(input, 'genderIdentity'),
    racialIdentity: optionalString(input, 'racialIdentity'),
    heightCm: optionalNumber(input, 'heightCm'),
    weightKg: optionalNumber(input, 'weightKg'),
    clothingSizes: clothingSizes ? {
      tops: optionalString(clothingSizes, 'tops'),
      bottoms: optionalString(clothingSizes, 'bottoms'),
      dresses: optionalString(clothingSizes, 'dresses'),
      outerwear: optionalString(clothingSizes, 'outerwear'),
    } : undefined,
    shoeSize: optionalString(input, 'shoeSize'),
    preferredFit: optionalString(input, 'preferredFit'),
    preferredColours: optionalStringArray(input, 'preferredColours'),
    avoidedColours: optionalStringArray(input, 'avoidedColours'),
    usualBudgetCad: optionalNumber(input, 'usualBudgetCad'),
    preferredRetailerIds: optionalStringArray(input, 'preferredRetailerIds'),
    excludedRetailerIds: optionalStringArray(input, 'excludedRetailerIds'),
    destination: destination ? { country: requiredString(destination, 'country'), region: optionalString(destination, 'region') } : undefined,
  }
}

export function setupProfileTool(actions: ThreadActions): WebMCPToolDefinition {
  return {
    name: 'setup_profile',
    title: 'Set up Rove profile',
    description: 'Create the minimal browser-local Rove profile. Existing data is preserved unless replaceExisting is explicitly true; optional preferences may be learned incrementally later with update_profile.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The person’s first name.' },
        ...optionalProfileProperties,
        replaceExisting: { type: 'boolean', description: 'Explicitly replace an existing profile.' },
      },
      required: ['name', 'shoppingDepartment'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute(input) {
      const result = actions.setupProfile({
        name: requiredString(input, 'name'),
        ...parseProfileFields(input),
        replaceExisting: optionalBoolean(input, 'replaceExisting'),
      })
      return { ...result, nextAction: 'start_shopping_search' }
    },
  }
}
