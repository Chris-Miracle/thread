import { OCCASIONS, PRODUCT_CATEGORIES, type Occasion, type ProductCategory } from '~/types/thread'

export function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must be a non-empty string.`)
  return value.trim()
}

export function requiredString(input: Record<string, unknown>, key: string): string {
  const value = optionalString(input, key)
  if (!value) throw new Error(`${key} is required.`)
  return value
}

export function optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${key} must be a number greater than zero.`)
  return value
}

export function optionalBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean.`)
  return value
}

export function optionalStringArray(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim())) {
    throw new Error(`${key} must be an array of non-empty strings.`)
  }
  return value.map(item => String(item).trim())
}

export function optionalCategory(input: Record<string, unknown>): ProductCategory | undefined {
  const value = optionalString(input, 'category')
  if (!value) return undefined
  if (!(PRODUCT_CATEGORIES as readonly string[]).includes(value)) throw new Error(`category must be one of: ${PRODUCT_CATEGORIES.join(', ')}.`)
  return value as ProductCategory
}

export function optionalOccasion(input: Record<string, unknown>): Occasion | undefined {
  const value = optionalString(input, 'occasion')
  if (!value) return undefined
  if (!(OCCASIONS as readonly string[]).includes(value)) throw new Error(`occasion must be one of: ${OCCASIONS.join(', ')}.`)
  return value as Occasion
}
