import { migrateProductSnapshot } from '~/domain/persistence'
import { productFreshnessKey } from '~/domain/productIdentity'
import { getSessionCollectionProducts, getSessionRootPrompt, getSessionRootSearchId } from '~/domain/research/collection'
import {
  emptyResearchHistory,
  type Product,
  type RecommendationReviewResolution,
  type ResearchHistoryState,
  type SavedResearchEntry,
  type SearchSession,
} from '~/types/thread'

export const RESEARCH_HISTORY_ENTRY_LIMIT = 30
export const SEEN_PRODUCT_KEY_LIMIT = 2_000

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function validResolution(value: unknown): value is RecommendationReviewResolution {
  return ['user-accepted', 'timeout-accepted', 'replace-selected', 'replace-all'].includes(String(value))
}

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

function cloneEntry(entry: SavedResearchEntry): SavedResearchEntry {
  return { ...entry, products: entry.products.map(cloneProduct) }
}

export function hydrateResearchHistory(value: unknown): ResearchHistoryState {
  const root = record(value)
  if (!root || root.version !== 1) return emptyResearchHistory()
  const entries = Array.isArray(root.entries)
    ? root.entries.flatMap((value) => {
        const entry = record(value)
        if (!entry || typeof entry.id !== 'string' || typeof entry.searchId !== 'string' || typeof entry.prompt !== 'string') return []
        if (typeof entry.acceptedAt !== 'string' || !validResolution(entry.resolution) || !Array.isArray(entry.products)) return []
        const products = entry.products.map(migrateProductSnapshot).filter((product): product is Product => Boolean(product))
        return [{
          id: entry.id,
          searchId: entry.searchId,
          prompt: entry.prompt,
          acceptedAt: entry.acceptedAt,
          resolution: entry.resolution,
          products,
        } satisfies SavedResearchEntry]
      }).slice(0, RESEARCH_HISTORY_ENTRY_LIMIT)
    : []
  const storedKeys = Array.isArray(root.seenProductKeys)
    ? root.seenProductKeys.filter((key): key is string => typeof key === 'string' && Boolean(key))
    : []
  const seenProductKeys = [...new Set([
    ...storedKeys,
    ...entries.flatMap(entry => entry.products.map(product => productFreshnessKey(product.url))),
  ])].slice(-SEEN_PRODUCT_KEY_LIMIT)
  return { version: 1, entries, seenProductKeys }
}

export function archiveReviewedSearch(
  history: ResearchHistoryState,
  session: SearchSession,
  likedProductIds: readonly string[],
  resolution: RecommendationReviewResolution,
  acceptedAt: string,
): ResearchHistoryState {
  const liked = new Set(likedProductIds)
  const collection = getSessionCollectionProducts(session)
  const rootSearchId = getSessionRootSearchId(session)
  const entry: SavedResearchEntry = {
    id: `history:${rootSearchId}`,
    searchId: rootSearchId,
    prompt: getSessionRootPrompt(session),
    acceptedAt,
    resolution,
    products: collection.filter(product => liked.has(product.id)).map(cloneProduct),
  }
  const entries = [
    entry,
    ...history.entries.filter(candidate => candidate.searchId !== rootSearchId).map(cloneEntry),
  ].slice(0, RESEARCH_HISTORY_ENTRY_LIMIT)
  const seenProductKeys = [...new Set([
    ...history.seenProductKeys,
    ...collection.map(product => productFreshnessKey(product.url)),
  ])].slice(-SEEN_PRODUCT_KEY_LIMIT)
  return { version: 1, entries, seenProductKeys }
}

export function recordSeenProducts(history: ResearchHistoryState, products: readonly Product[]): ResearchHistoryState {
  return {
    version: 1,
    entries: history.entries.map(cloneEntry),
    seenProductKeys: [...new Set([
      ...history.seenProductKeys,
      ...products.map(product => productFreshnessKey(product.url)),
    ])].slice(-SEEN_PRODUCT_KEY_LIMIT),
  }
}

export function cloneResearchHistory(history: ResearchHistoryState): ResearchHistoryState {
  return {
    version: 1,
    entries: history.entries.map(cloneEntry),
    seenProductKeys: [...history.seenProductKeys],
  }
}
