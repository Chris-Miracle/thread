import type { Product } from '~/types/thread'

export interface ProductVariantPolicy {
  colorOptions: string[]
  sizeOptions: string[]
  requiresColor: boolean
  requiresSize: boolean
  guidance: string
}

const FIXED_LISTING_CATEGORIES = new Set<Product['category']>(['fragrance'])

export function getProductVariantPolicy(product: Product): ProductVariantPolicy {
  const listingDefinesTheVariant = FIXED_LISTING_CATEGORIES.has(product.category)
  const colorOptions = listingDefinesTheVariant ? [] : [...product.colors]
  const sizeOptions = listingDefinesTheVariant ? [] : [...product.sizes]

  return {
    colorOptions,
    sizeOptions,
    requiresColor: colorOptions.length > 0,
    requiresSize: sizeOptions.length > 0,
    guidance: product.category === 'fragrance'
      ? 'Bottle volume is already defined by this listing. No apparel size or colour selection is needed.'
      : 'This item is sold as listed. No size or colour selection is needed.',
  }
}

export function resolveCartVariant(
  product: Product,
  options: { size?: string; color?: string } = {},
): { size?: string; color?: string } {
  const policy = getProductVariantPolicy(product)
  const size = policy.requiresSize ? options.size?.trim() || undefined : undefined
  const color = policy.requiresColor ? options.color?.trim() || undefined : undefined

  if (policy.requiresSize && !size) throw new Error(`Select a size for ${product.name}.`)
  if (policy.requiresColor && !color) throw new Error(`Select a colour for ${product.name}.`)
  if (size && !policy.sizeOptions.includes(size)) throw new Error(`${size} is not an available size for ${product.name}.`)
  if (color && !policy.colorOptions.includes(color)) throw new Error(`${color} is not an available colour for ${product.name}.`)

  return { size, color }
}
