import type { Product, ResultFilters } from '~/types/thread'

export function filterProducts(products: Product[], filters: ResultFilters): Product[] {
  const visible = products.filter(product => {
    if (filters.retailer && product.retailer !== filters.retailer) return false
    if (filters.brand && product.brand !== filters.brand) return false
    if (filters.category && product.category !== filters.category) return false
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) return false
    return true
  })

  if (filters.sort === 'price-asc') return visible.toSorted((a, b) => a.price - b.price)
  if (filters.sort === 'price-desc') return visible.toSorted((a, b) => b.price - a.price)
  return visible
}
