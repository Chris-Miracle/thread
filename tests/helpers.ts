import { ref } from 'vue'
import { PRODUCTS } from '../app/data/products'
import { createThreadActions } from '../app/domain/threadActions'
import { emptyCartState, emptySearchState, type CartState, type Product, type ProductCandidateInput, type SearchState, type StyleProfile } from '../app/types/thread'
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

/** The brief Rove is built to run hands-off. */
export const FLAGSHIP_BRIEF = 'I\'m going on a vacation to Cancun get me three clothes and a perfume, two footwears with a budget of $450 CAD'

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
  const cart = ref<CartState>(emptyCartState())
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

type Actions = ReturnType<typeof makeActions>['actions']

/** Mirrors an agent without Shop connected: every Shop catalogue target resolves as no-results. */
export function resolveShopCatalogAsUnavailable(actions: Actions, searchId: string) {
  const queued = () => actions.getSearchStatus(searchId).targets
    .filter(target => target.sourceType === 'catalog' && target.status === 'queued').length
  for (let remaining = queued(); remaining > 0; remaining = queued()) {
    const claimed = actions.claimSearchTargets({ searchId, limit: Math.min(4, remaining) }).targets
    for (const target of claimed) {
      if (target.sourceType !== 'catalog') throw new Error(`Expected a Shop catalogue target, claimed ${target.id}.`)
      actions.completeSearchTarget({ searchId, targetId: target.id, status: 'no-results', note: 'Shop unavailable' })
    }
  }
}

export function claimRetailerTargets(actions: Actions, input: Parameters<Actions['claimSearchTargets']>[0]) {
  resolveShopCatalogAsUnavailable(actions, input.searchId)
  return actions.claimSearchTargets(input)
}
