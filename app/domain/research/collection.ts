import { productFreshnessKey } from '~/domain/productIdentity'
import type { Product, SearchSession } from '~/types/thread'

function cloneProduct(product: Product): Product {
  return {
    ...product,
    needIds: [...product.needIds],
    colors: [...product.colors],
    sizes: [...product.sizes],
    styleTags: [...product.styleTags],
    occasionTags: [...product.occasionTags],
  }
}

export function getSessionCollectionProducts(session: SearchSession): Product[] {
  const replaced = new Set(session.replacementContext?.replacedProductIds ?? [])
  const products = [
    ...(session.replacementContext?.preservedProducts ?? []),
    ...session.products,
  ].filter(product => !replaced.has(product.id))
  const byFamily = new Map<string, Product>()
  for (const product of products) byFamily.set(productFreshnessKey(product.url), cloneProduct(product))
  return [...byFamily.values()]
}

export function getSessionRootSearchId(session: SearchSession): string {
  return session.replacementContext?.rootSearchId ?? session.id
}

export function getSessionRootPrompt(session: SearchSession): string {
  return session.replacementContext?.rootPrompt ?? session.mission.rawPrompt
}
