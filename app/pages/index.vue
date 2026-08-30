<script setup lang="ts">
import { LoaderCircle, Sparkles } from 'lucide-vue-next'
import { filterProducts } from '~/domain/productFilters'
import { emptyResultFilters, type Product, type ShoppingGender, type StyleId } from '~/types/thread'

const { profile } = useThreadProfile()
const { search } = useThreadSearch()
const { toast, dismissToast } = useThreadToast()
const { status: webmcpStatus } = useWebMCPStatus()
const actions = useThreadActions()
const route = useRoute()
const cartOpen = ref(false)
const profileOpen = ref(false)
const resetOpen = ref(false)
const selectedProduct = ref<Product | null>(null)
const actionError = ref('')
const filters = ref(emptyResultFilters())
const lane = computed(() => search.value.results)
const filteredProducts = computed(() => filterProducts(lane.value.results, filters.value))
const cartSummary = computed(() => actions.getCart())
const showDebug = computed(() => import.meta.dev && route.query.debug === 'true')
const isSearching = computed(() => lane.value.status === 'loading' || lane.value.status === 'exploring')

watch(() => lane.value.searchId ?? `${lane.value.startedAt}:${lane.value.query}`, () => { filters.value = emptyResultFilters() })

function saveProfile(input: { name: string; gender: ShoppingGender; styles: StyleId[] }) {
  actions.saveStyleProfile(input)
  profileOpen.value = false
}
function quickAdd(product: Product) {
  actionError.value = ''
  try { actions.addToCart(product.id, {}, 'human') }
  catch (error) { actionError.value = error instanceof Error ? error.message : 'Could not add this product.' }
}
function addFromDetail(options: { size?: string; color?: string }) {
  if (!selectedProduct.value) return
  actionError.value = ''
  try { actions.addToCart(selectedProduct.value.id, options, 'human'); selectedProduct.value = null }
  catch (error) { actionError.value = error instanceof Error ? error.message : 'Could not add this product.' }
}
function resetWorkspace() {
  actions.resetWorkspace()
  resetOpen.value = false
}
</script>

<template>
  <div class="min-h-dvh bg-thread-canvas text-thread-ink">
    <ThreadOnboarding v-if="!profile" @save="saveProfile" />
    <template v-else>
      <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-thread-ink focus:px-4 focus:py-3 focus:text-white">Skip to shopping</a>
      <ThreadHeader :profile="profile" :cart-count="cartSummary.itemCount" @open-cart="cartOpen = true" @edit-profile="profileOpen = true" @reset="resetOpen = true" />
      <main id="main-content" class="mx-auto max-w-[1600px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
        <section class="max-w-5xl">
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-thread-accent">Agent-native shopping workspace</p>
          <h1 class="mt-4 max-w-4xl font-editorial text-5xl leading-[0.94] tracking-[-0.025em] sm:text-7xl lg:text-[88px]">What are we dressing for, <span class="italic">{{ profile.name }}</span>?</h1>
          <p class="mt-7 max-w-2xl text-base leading-7 text-thread-muted sm:text-lg">Ask your agent to find the occasion, budget, or exact piece. Verified retailer finds will appear here as they are discovered.</p>
        </section>
        <p v-if="actionError || lane.error" role="alert" class="mt-6 border-l-2 border-thread-danger pl-3 text-sm text-thread-danger">{{ actionError || lane.error }}</p>
        <section class="mt-16 sm:mt-20" aria-labelledby="results-heading" aria-live="polite">
          <div class="mb-7 flex items-end justify-between gap-4 border-b border-thread-line pb-4">
            <div>
              <p class="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-thread-muted">
                <LoaderCircle v-if="isSearching" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <Sparkles v-else-if="lane.hasSearched" class="h-3.5 w-3.5" aria-hidden="true" />
                {{ isSearching ? 'Searching retailers now' : lane.hasSearched ? 'Current search' : 'Ready for your first search' }}
              </p>
              <h2 id="results-heading" class="mt-1 font-editorial text-4xl sm:text-5xl">{{ lane.hasSearched ? `“${lane.query}”` : 'Your finds will live here' }}</h2>
            </div>
            <p v-if="lane.hasSearched" class="shrink-0 text-xs tabular-nums text-thread-muted"><strong class="font-medium text-thread-ink">{{ lane.results.length }} total preserved</strong><span v-if="filteredProducts.length !== lane.results.length"> · {{ filteredProducts.length }} shown</span></p>
          </div>
          <EmptyState v-if="!lane.hasSearched" title="Nothing here—yet." description="Start a shopping request with your agent. Products only appear after they are grounded in real retailer pages." />
          <template v-else>
            <ResearchProgress :targets="lane.researchTargets" :searching="isSearching" />
            <ProductFilters v-if="lane.results.length" v-model="filters" :products="lane.results" class="mb-7" />
            <ProductGrid :products="filteredProducts" :loading="isSearching" @select="selectedProduct = $event" @add="quickAdd" />
            <EmptyState v-if="!isSearching && lane.status === 'success' && !lane.results.length" title="No verified products found." description="Ask your agent to broaden the stores, budget, or description and start a new search." />
            <EmptyState v-else-if="lane.results.length && !filteredProducts.length" title="No products match these filters." description="Clear one or more filters to see the agent’s other finds." />
            <p v-if="isSearching && lane.results.length" class="mt-8 flex items-center gap-2 text-sm text-thread-muted"><LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" /> Still searching—new verified products will join this list.</p>
          </template>
        </section>
      </main>
      <footer class="border-t border-thread-line px-5 py-7 sm:px-8 lg:px-12">
        <div class="mx-auto flex max-w-[1504px] flex-col gap-3 text-xs text-thread-muted sm:flex-row sm:items-center sm:justify-between">
          <p>THREAD / Real retailer links. Prices and stock are observations, not guarantees.</p>
          <WebMCPStatus :supported="webmcpStatus.supported" :registered="webmcpStatus.registered" />
        </div>
      </footer>
      <CartDrawer v-if="cartOpen" :cart="cartSummary" @close="cartOpen = false" @remove="actions.removeFromCart" @clear="actions.clearCart" />
      <ProductDetail v-if="selectedProduct" :product="selectedProduct" @close="selectedProduct = null" @add="addFromDetail" />
      <ResetWorkspaceDialog v-if="resetOpen" @cancel="resetOpen = false" @confirm="resetWorkspace" />
      <div v-if="profileOpen" class="fixed inset-0 z-50 overflow-y-auto"><ThreadOnboarding :profile="profile" editing @save="saveProfile" @cancel="profileOpen = false" /></div>
      <ThreadDebugPanel v-if="showDebug" />
    </template>
    <ThreadToast :toast="toast" @dismiss="dismissToast" />
  </div>
</template>
