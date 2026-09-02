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
    requiresColor: colorOptions.length > 1,
    requiresSize: sizeOptions.length > 1,
    guidance: product.category === 'fragrance'
      ? 'Bottle volume is already defined by this listing. No apparel size or colour selection is needed.'
      : colorOptions.length === 1 || sizeOptions.length === 1
        ? 'The listing has one fixed variant, so Rove will use it automatically.'
        : 'This item is sold as listed. No size or colour selection is needed.',
  }
}

export function resolveCartVariant(
  product: Product,
  options: { size?: string; color?: string } = {},
): { size?: string; color?: string } {
  const policy = getProductVariantPolicy(product)
  const size = policy.sizeOptions.length === 1
    ? policy.sizeOptions[0]
    : policy.requiresSize ? options.size?.trim() || undefined : undefined
  const color = policy.colorOptions.length === 1
    ? policy.colorOptions[0]
    : policy.requiresColor ? options.color?.trim() || undefined : undefined

  if (policy.requiresSize && !size) throw new Error(`Select a size for ${product.name}.`)
  if (policy.requiresColor && !color) throw new Error(`Select a colour for ${product.name}.`)
  if (size && !policy.sizeOptions.includes(size)) throw new Error(`${size} is not an available size for ${product.name}.`)
  if (color && !policy.colorOptions.includes(color)) throw new Error(`${color} is not an available colour for ${product.name}.`)

  return { size, color }
}
