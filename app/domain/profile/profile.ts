import { RETAILER_BY_ID } from '~/data/retailers'
import {
  MAX_PROFILE_STYLES, MIN_PROFILE_STYLES, SHOPPING_DEPARTMENTS, STYLE_OPTIONS,
  type ShoppingDepartment, type StyleId, type StyleProfile,
} from '~/types/thread'

const departmentIds = new Set<string>(SHOPPING_DEPARTMENTS.map(option => option.id))
const styleIds = new Set<string>(STYLE_OPTIONS.map(option => option.id))

export interface ProfileInput {
  name: string
  shoppingDepartment?: string
  gender?: string
  genderIdentity?: string
  racialIdentity?: string
  heightCm?: number
  weightKg?: number
  styles?: readonly string[]
  clothingSizes?: StyleProfile['clothingSizes']
  shoeSize?: string
  preferredFit?: string
  preferredColours?: readonly string[]
  avoidedColours?: readonly string[]
  usualBudgetCad?: number
  preferredRetailerIds?: readonly string[]
  excludedRetailerIds?: readonly string[]
}

function cleanOptional(value: unknown, max = 80): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : undefined
}

function cleanList(value: readonly string[] | undefined, maxItems = 20): string[] | undefined {
  if (!value) return undefined
  const list = [...new Set(value.map(item => item.trim().slice(0, 80)).filter(Boolean))].slice(0, maxItems)
  return list.length ? list : undefined
}

function retailerList(value: readonly string[] | undefined): string[] | undefined {
  const list = [...new Set(value ?? [])].filter(id => RETAILER_BY_ID.has(id))
  return list.length ? list : undefined
}

function boundedNumber(value: number | undefined, label: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`)
  }
  return Number(value.toFixed(2))
}

export function validateProfile(input: ProfileInput, requireStyle: boolean): StyleProfile {
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!name) throw new Error('Enter your first name to continue.')
  const department = input.shoppingDepartment ?? input.gender
  if (!department || !departmentIds.has(department)) throw new Error('Choose who you are shopping for.')
  const styles = [...new Set(input.styles ?? [])]
  if (requireStyle && styles.length < MIN_PROFILE_STYLES) throw new Error(`Choose at least ${MIN_PROFILE_STYLES} styles.`)
  if (styles.length > MAX_PROFILE_STYLES) throw new Error(`Choose up to ${MAX_PROFILE_STYLES} styles.`)
  if (!styles.every(style => styleIds.has(style))) throw new Error('One or more selected styles are not supported.')
  if (input.usualBudgetCad !== undefined && (!Number.isFinite(input.usualBudgetCad) || input.usualBudgetCad <= 0)) {
    throw new Error('Usual budget must be a positive CAD amount.')
  }
  const preferredRetailerIds = retailerList(input.preferredRetailerIds)
  const excludedRetailerIds = retailerList(input.excludedRetailerIds)?.filter(id => !preferredRetailerIds?.includes(id))
  const clothingSizes = input.clothingSizes
    ? Object.fromEntries(Object.entries(input.clothingSizes)
        .map(([key, value]) => [key, cleanOptional(value)])
        .filter((entry): entry is [string, string] => Boolean(entry[1]))) as StyleProfile['clothingSizes']
    : undefined
  return {
    version: 4,
    name,
    shoppingDepartment: department as ShoppingDepartment,
    styles: styles as StyleId[],
    genderIdentity: cleanOptional(input.genderIdentity),
    racialIdentity: cleanOptional(input.racialIdentity),
    heightCm: boundedNumber(input.heightCm, 'Height in centimetres', 80, 250),
    weightKg: boundedNumber(input.weightKg, 'Weight in kilograms', 20, 400),
    clothingSizes: clothingSizes && Object.keys(clothingSizes).length ? clothingSizes : undefined,
    shoeSize: cleanOptional(input.shoeSize),
    preferredFit: cleanOptional(input.preferredFit),
    preferredColours: cleanList(input.preferredColours),
    avoidedColours: cleanList(input.avoidedColours),
    usualBudgetCad: input.usualBudgetCad !== undefined ? Number(input.usualBudgetCad.toFixed(2)) : undefined,
    preferredRetailerIds,
    excludedRetailerIds,
  }
}

export function migrateProfile(value: unknown): StyleProfile | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const shoppingDepartment = typeof record.shoppingDepartment === 'string'
    ? record.shoppingDepartment
    : typeof record.gender === 'string'
      ? record.gender
      : undefined
  if (typeof record.name !== 'string' || !Array.isArray(record.styles)) return null
  try {
    return validateProfile({
      name: record.name,
      shoppingDepartment,
      styles: record.styles.filter((style): style is string => typeof style === 'string'),
      genderIdentity: typeof record.genderIdentity === 'string' ? record.genderIdentity : undefined,
      racialIdentity: typeof record.racialIdentity === 'string' ? record.racialIdentity : undefined,
      heightCm: typeof record.heightCm === 'number' ? record.heightCm : undefined,
      weightKg: typeof record.weightKg === 'number' ? record.weightKg : undefined,
      clothingSizes: record.clothingSizes && typeof record.clothingSizes === 'object'
        ? record.clothingSizes as StyleProfile['clothingSizes']
        : undefined,
      shoeSize: typeof record.shoeSize === 'string' ? record.shoeSize : undefined,
      preferredFit: typeof record.preferredFit === 'string' ? record.preferredFit : undefined,
      preferredColours: Array.isArray(record.preferredColours) ? record.preferredColours.filter((item): item is string => typeof item === 'string') : undefined,
      avoidedColours: Array.isArray(record.avoidedColours) ? record.avoidedColours.filter((item): item is string => typeof item === 'string') : undefined,
      usualBudgetCad: typeof record.usualBudgetCad === 'number' ? record.usualBudgetCad : undefined,
      preferredRetailerIds: Array.isArray(record.preferredRetailerIds) ? record.preferredRetailerIds.filter((item): item is string => typeof item === 'string') : undefined,
      excludedRetailerIds: Array.isArray(record.excludedRetailerIds) ? record.excludedRetailerIds.filter((item): item is string => typeof item === 'string') : undefined,
    }, false)
  } catch {
    return null
  }
}

export function updateProfile(current: StyleProfile, patch: Partial<ProfileInput>): StyleProfile {
  return validateProfile({
    ...current,
    ...patch,
    name: patch.name ?? current.name,
    shoppingDepartment: patch.shoppingDepartment ?? patch.gender ?? current.shoppingDepartment,
    styles: patch.styles ?? current.styles,
  }, false)
}
