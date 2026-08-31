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
    observedAt: product.observedAt,
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
      url: item.product.url,
    })),
    unpricedItemCount: cart.unpricedItemCount,
  }
}
