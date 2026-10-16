import type { ShopSelectedOption } from '~/types/thread'
import { requiredArray, requiredString } from '~/webmcp/toolInput'

export const shopOptionsSchema = {
  type: 'array', maxItems: 6,
  items: {
    type: 'object',
    properties: { name: { type: 'string' }, label: { type: 'string' } },
    required: ['name', 'label'], additionalProperties: false,
  },
} as const

export function parseShopOptions(input: Record<string, unknown>, key: string): ShopSelectedOption[] | undefined {
  if (input[key] === undefined) return undefined
  return requiredArray(input, key).map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key}[${index}] must be an option name/label pair.`)
    const entry = value as Record<string, unknown>
    return { name: requiredString(entry, 'name'), label: requiredString(entry, 'label') }
  })
}
