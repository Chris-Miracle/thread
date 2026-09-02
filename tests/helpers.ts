import { ref } from 'vue'
import { PRODUCTS } from '../app/data/products'
import { createThreadActions } from '../app/domain/threadActions'
import { emptySearchState, type CartState, type Product, type ProductCandidateInput, type SearchState, type StyleProfile } from '../app/types/thread'
import type { StorageAdapter } from '../app/utils/storage'

export interface MemoryStorage extends StorageAdapter {
  values: Map<string, string>
}

export function makeStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

export const DEFAULT_PROFILE: StyleProfile = {
  version: 4,
  name: 'Chris',
  shoppingDepartment: 'women',
  styles: ['minimal', 'smart-casual'],
}

export function makeActions(options: {
  profile?: StyleProfile | null
  storage?: MemoryStorage
  hydrated?: boolean
  fixtures?: readonly Product[]
} = {}) {
  const profile = ref<StyleProfile | null>(options.profile === undefined ? DEFAULT_PROFILE : options.profile)
  const cart = ref<CartState>({ version: 3, items: [] })
  const search = ref<SearchState>(emptySearchState())
  const hydrated = ref(options.hydrated ?? true)
  const storage = options.storage ?? makeStorage()
  const actions = createThreadActions({
    profile,
    cart,
    search,
    hydrated,
    storage,
    fixtures: options.fixtures ?? PRODUCTS,
  })
  return { actions, profile, cart, search, hydrated, storage }
}

export function candidateFromFixture(product: Product): ProductCandidateInput {
  return {
    url: product.url,
    name: product.name,
    brand: product.brand,
    nativePrice: product.nativePrice,
    nativeCurrency: product.nativeCurrency,
    priceCad: product.priceCad,
    image: product.image ?? 'https://images.example.test/thread-product.jpg',
    category: product.category,
    shoppingDepartment: product.shoppingDepartment,
    needIds: product.needIds.length ? product.needIds : undefined,
  }
}

export function startRestrictedSearch(
  harness: ReturnType<typeof makeActions>,
  retailerIds: string[],
  rawPrompt = 'Find dinner clothes under $180 CAD',
) {
  return harness.actions.startShoppingSearch({
    rawPrompt,
    context: { occasions: ['dinner'] },
    constraints: { maxPriceCad: 180, retailerIds },
    needs: [{ intent: 'dinner', queries: ['dinner outfit'], categories: [], required: true }],
  })
}
