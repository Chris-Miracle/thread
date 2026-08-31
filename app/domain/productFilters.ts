import type { Product, ResultFilters } from '~/types/thread'

export function filterProducts(products: Product[], filters: ResultFilters): Product[] {
  const visible = products.filter(product => {
    if (filters.retailer && product.retailer !== filters.retailer) return false
    if (filters.brand && product.brand !== filters.brand) return false
    if (filters.category && product.category !== filters.category) return false
    if (filters.maxPriceCad !== undefined && (product.priceCad === undefined || product.priceCad > filters.maxPriceCad)) return false
    return true
  })

  if (filters.sort === 'price-asc') return visible.toSorted((a, b) => (a.priceCad ?? Number.POSITIVE_INFINITY) - (b.priceCad ?? Number.POSITIVE_INFINITY))
  if (filters.sort === 'price-desc') return visible.toSorted((a, b) => (b.priceCad ?? Number.NEGATIVE_INFINITY) - (a.priceCad ?? Number.NEGATIVE_INFINITY))
  if (filters.sort === 'newest') return visible.toSorted((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
  return visible
}
