import type { Product } from '~/types/thread'

/** Shop results link to the exact returned URL, query parameters included; everything else to the canonical page. */
export function productLink(product: Product): string {
  return product.commerce?.url ?? product.url
}

export function productProvenance(product: Product, detailed = false): string {
  if (product.commerce) return detailed ? 'Found through the Shop catalogue' : 'via Shop'
  if (product.source === 'agent') return detailed ? 'Agent sourced from canonical retailer page' : 'Agent sourced'
  return detailed ? 'Development fixture' : 'Fixture'
}
