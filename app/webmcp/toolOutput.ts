import type { CartSummary, Product } from '~/types/thread'

export function compactProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    retailer: product.retailer,
    retailerId: product.retailerId,
    needIds: product.needIds,
    category: product.category,
    priceCad: product.priceCad,
    nativePrice: product.nativePrice,
    nativeCurrency: product.nativeCurrency,
    url: product.url,
    image: product.image,
    stage: product.stage,
    sizes: product.sizes,
    colors: product.colors,
    availability: product.availability,
    variants: product.variants,
    observedAt: product.observedAt,
    shop: product.commerce
      ? {
          productId: product.commerce.productId,
          variantId: product.commerce.variantId,
          sellerDomain: product.commerce.sellerDomain,
          url: product.commerce.url,
          selectedOptions: product.commerce.selectedOptions,
          checkoutUrl: product.commerce.checkoutUrl,
        }
      : undefined,
  }
}

export function compactCart(cart: CartSummary) {
  return {
    itemCount: cart.itemCount,
    totals: cart.totals,
    items: cart.items.map(item => ({
      itemId: item.id,
      productId: item.productId,
      name: item.product.name,
      retailer: item.product.retailer,
      priceCad: item.product.priceCad,
      size: item.size,
      color: item.color,
      variantId: item.variantId,
      selectedOptions: item.selectedOptions,
      url: item.product.commerce?.url ?? item.product.url,
    })),
    unpricedItemCount: cart.unpricedItemCount,
    groups: cart.groups.map(group => ({ key: group.key, sellerName: group.sellerName, status: group.status, continueUrl: group.merchantCart?.continueUrl })),
  }
}
