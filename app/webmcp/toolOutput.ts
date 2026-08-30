import type { CartSummary, Product } from '~/types/thread'

export function compactProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    retailer: product.retailer,
    price: product.price,
    currency: product.currency,
    url: product.url,
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
      price: item.product.price,
      currency: item.product.currency,
      size: item.size,
      color: item.color,
      url: item.product.url,
    })),
  }
}
