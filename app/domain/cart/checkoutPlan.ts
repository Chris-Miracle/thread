import { stableHash } from '~/domain/productIdentity'
import type {
  CartItem, CartSelection, CartState, CheckoutGroup, CheckoutGroupStatus, Product, ProductVariant, ShopSelectedOption,
} from '~/types/thread'

const SIZE_OPTION = /^(?:(?:us|uk|eu|mens|men's|womens|women's|numeric|shoe|clothing|waist|chest)\s+)*size(?:\s*\([^)]+\))?$/i
const COLOR_OPTION = /^colou?r$/i

/** Merchant option names that carry a wearable size, e.g. "Size", "Numeric shoe size", "US Size". */
export function isSizeOption(name: string): boolean {
  return SIZE_OPTION.test(name.trim())
}

export function isColorOption(name: string): boolean {
  return COLOR_OPTION.test(name.trim())
}

export function cartGroupKey(product: Product): string {
  return product.commerce ? `shop:${product.commerce.sellerDomain}` : `retailer:${product.retailerId}`
}

export function variantSize(options: readonly ShopSelectedOption[]): string | undefined {
  return options.find(option => isSizeOption(option.name))?.label
}

export function variantColor(options: readonly ShopSelectedOption[]): string | undefined {
  return options.find(option => isColorOption(option.name))?.label
}

/** Option names and labels are merchant-owned. Never infer a combination from independent lists. */
export function sameOptions(left: readonly ShopSelectedOption[], right: readonly ShopSelectedOption[]): boolean {
  const key = (options: readonly ShopSelectedOption[]) => options.map(o => `${o.name}\u0000${o.label}`).sort()
  return JSON.stringify(key(left)) === JSON.stringify(key(right))
}

export function matchVariant(product: Product, size?: string, color?: string, selection: CartSelection = {}): ProductVariant | undefined {
  const candidates = product.variants?.filter(variant => (!selection.variantId || variant.id === selection.variantId)
    && (size === undefined || variant.size === size)
    && (color === undefined || variant.color === color)
    && (!selection.selectedOptions || sameOptions(variant.options, selection.selectedOptions))) ?? []
  if (candidates.length === 1) return candidates[0]
  // Preserve the exact featured combination, including width, finish, volume and accessory size.
  return candidates.find(variant => sameOptions(variant.options, product.commerce?.selectedOptions ?? []))
}

/** Categories bought in a size; a listing in one of these is never added to Your Thread without one. */
export const SIZED_PRODUCT_CATEGORIES: ReadonlySet<string> = new Set(['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'swimwear', 'activewear'])

export function hasRequiredShopOptions(product: Product, variant: ProductVariant): boolean {
  return !SIZED_PRODUCT_CATEGORIES.has(product.category ?? '') || Boolean(variant.size)
}

/** Use a supplied merchant checkout URL only; never construct one from IDs. */
export function directCheckoutUrl(item: CartItem): string | undefined {
  const variant = item.product.variants?.find(v => v.id === item.variantId)
  if (!variant?.available || !hasRequiredShopOptions(item.product, variant) || !variant.checkoutUrl || !sameOptions(variant.options, item.selectedOptions ?? variant.options)) return undefined
  try {
    const url = new URL(variant.checkoutUrl)
    return url.protocol === 'https:' && !url.username && !url.password ? variant.checkoutUrl : undefined
  } catch { return undefined }
}

function optionName(product: Product, pattern: RegExp, fallback: string): string {
  const names = [
    ...(product.variants ?? []).flatMap(variant => variant.options),
    ...(product.commerce?.selectedOptions ?? []),
  ].map(option => option.name)
  return names.find(name => pattern.test(name)) ?? fallback
}

/** The cart selection expressed in the product's own Shop option names, ready for get_product `selected`. */
export function selectedOptionsFor(item: CartItem): ShopSelectedOption[] {
  if (item.selectedOptions) return item.selectedOptions.map(option => ({ ...option }))
  const exact = item.product.variants?.find(variant => variant.id === item.variantId)
  if (exact) return exact.options.map(option => ({ ...option }))
  const selected: ShopSelectedOption[] = []
  if (item.size) selected.push({ name: optionName(item.product, SIZE_OPTION, 'Size'), label: item.size })
  if (item.color) selected.push({ name: optionName(item.product, COLOR_OPTION, 'Color'), label: item.color })
  return selected
}

export function groupItemsHash(items: readonly CartItem[]): string {
  return stableHash(items.map(item => `${item.id}:${item.variantId ?? ''}:${item.product.priceCad ?? ''}:${item.product.nativeCurrency ?? ''}`).sort().join('|'))
}

export function groupCartItems(items: readonly CartItem[]): Map<string, CartItem[]> {
  const groups = new Map<string, CartItem[]>()
  for (const item of items) {
    const key = cartGroupKey(item.product)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return groups
}

export function buildCheckoutGroups(cart: CartState): CheckoutGroup[] {
  return [...groupCartItems(cart.items).entries()].map(([key, items]) => {
    const lead = items[0]!.product
    const provider = lead.commerce ? 'shop' as const : 'retailer' as const
    const merchantCart = cart.merchantCarts.find(candidate => candidate.groupKey === key)
    let status: CheckoutGroupStatus = 'buy-at-retailer'
    if (provider === 'shop') {
      status = !merchantCart
        ? 'needs-cart'
        : merchantCart.status === 'ordered'
          ? 'ordered'
          : merchantCart.itemsHash === groupItemsHash(items) ? 'ready' : 'stale'
    }
    return {
      key,
      provider,
      sellerName: lead.commerce?.sellerName ?? lead.retailer,
      sellerDomain: lead.commerce?.sellerDomain,
      lines: items.map(item => {
        const variant = item.product.variants?.find(variant => variant.id === item.variantId && variant.available && hasRequiredShopOptions(item.product, variant))
        return ({
        itemId: item.id,
        productId: item.productId,
        name: item.product.name,
        quantity: 1 as const,
        priceCad: item.product.priceCad,
        retailerUrl: item.product.commerce?.url ?? item.product.url,
        shopProductId: item.product.commerce?.productId,
        variantId: item.product.commerce ? variant?.id : item.variantId,
        selected: selectedOptionsFor(item),
        checkoutUrl: directCheckoutUrl(item),
      }) }),
      estimatedSubtotalCad: Number(items.reduce((sum, item) => sum + (item.product.priceCad ?? 0), 0).toFixed(2)),
      status,
      merchantCart: merchantCart ? { ...merchantCart, messages: [...merchantCart.messages] } : undefined,
    }
  })
}

/** Handoffs only survive while their seller group still has items. */
export function pruneMerchantCarts(cart: CartState): CartState['merchantCarts'] {
  const keys = new Set(cart.items.map(item => cartGroupKey(item.product)))
  return cart.merchantCarts.filter(merchantCart => keys.has(merchantCart.groupKey))
}
