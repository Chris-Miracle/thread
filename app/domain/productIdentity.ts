const TRACKING_PARAMETERS = new Set([
  'gclid', 'fbclid', 'msclkid', 'ref', 'ref_', 'source', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term',
])

export function canonicalizeProductUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Product URL must use HTTPS or HTTP.')
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key)
  }
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  url.searchParams.sort()
  return url.toString()
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

export function productIdFromUrl(value: string): string {
  const canonical = canonicalizeProductUrl(value)
  const domain = new URL(canonical).hostname.split('.')[0] ?? 'product'
  return `product:${domain}:${stableHash(canonical)}`
}

const VARIANT_PARAMETERS = new Set([
  'catid', 'color', 'colorid', 'colour', 'colourid', 'size', 'sku', 'variant',
])

/** Stable product-family identity used to keep later research genuinely fresh. */
export function productFreshnessKey(value: string): string {
  const canonical = new URL(canonicalizeProductUrl(value))
  for (const key of [...canonical.searchParams.keys()]) {
    if (VARIANT_PARAMETERS.has(key.toLowerCase())) canonical.searchParams.delete(key)
  }
  canonical.searchParams.sort()
  return canonical.toString()
}

export function cartItemId(productId: string, size?: string, color?: string): string {
  const variant = `${productId}|${size?.trim().toLowerCase() ?? ''}|${color?.trim().toLowerCase() ?? ''}`
  return `cart:${stableHash(variant)}`
}
