<script setup lang="ts">
import { LoaderCircle, Sparkles } from 'lucide-vue-next'
import { filterProducts } from '~/domain/productFilters'
import type { ProfileInput } from '~/domain/profile/profile'
import { getProductVariantPolicy } from '~/domain/products/productVariants'
import { getSessionCollectionProducts, getSessionRootPrompt } from '~/domain/research/collection'
import { emptyResultFilters, type Product } from '~/types/thread'

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
const session = computed(() => search.value.activeSearch)
const products = computed(() => session.value ? getSessionCollectionProducts(session.value) : [])
const filteredProducts = computed(() => filterProducts(products.value, filters.value))
const cartSummary = computed(() => actions.getCart())
const showDebug = computed(() => import.meta.dev && route.query.debug === 'true')
const isSearching = computed(() => session.value?.status === 'active')
const reviewPending = computed(() => session.value?.recommendationReview?.status === 'pending')
const hasCurrentMission = computed(() => Boolean(session.value && (isSearching.value || reviewPending.value)))
const currentPrompt = computed(() => session.value ? getSessionRootPrompt(session.value) : '')
const replacementCount = computed(() => session.value?.replacementContext?.replacedProductIds.length ?? 0)
const savedEntries = computed(() => {
  search.value.activeSearch?.revision
  return actions.getResearchHistory().entries
})

watch(() => session.value?.id, () => { filters.value = emptyResultFilters() })

function saveProfile(input: ProfileInput) {
  actions.saveStyleProfile(input)
  profileOpen.value = false
}

function quickAdd(product: Product) {
  actionError.value = ''
  const variantPolicy = getProductVariantPolicy(product)
  if (product.stage !== 'enriched' || variantPolicy.requiresSize || variantPolicy.requiresColor) {
    selectedProduct.value = product
    return
  }
  try {
    actions.addToCart(product.id, {}, 'human')
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not add this product.'
  }
}

function addFromDetail(options: { size?: string; color?: string }) {
  if (!selectedProduct.value) return
  actionError.value = ''
  try {
    actions.addToCart(selectedProduct.value.id, options, 'human')
    selectedProduct.value = null
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not add this product.'
  }
}

function stopResearch() {
  if (!session.value || session.value.status !== 'active') return
  actionError.value = ''
  try {
    actions.cancelSearch(session.value.id, 'Stopped from the Rove workspace.')
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not stop this search.'
  }
}

function acceptRecommendations() {
  if (!session.value) return
  actionError.value = ''
  try {
    actions.reviewRecommendations({ searchId: session.value.id, decision: 'accept-all' })
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not save this review.'
  }
}

function replaceRecommendations(productIds: string[]) {
  if (!session.value) return
  actionError.value = ''
  try {
    actions.reviewRecommendations({ searchId: session.value.id, decision: 'replace-selected', rejectedProductIds: productIds })
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not start replacement research.'
  }
}

function replaceAllRecommendations() {
  if (!session.value) return
  actionError.value = ''
  try {
    actions.reviewRecommendations({ searchId: session.value.id, decision: 'replace-all' })
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not restart this research.'
  }
}

function researchAgain() {
  if (!session.value) return
  actionError.value = ''
  try {
    actions.researchAgain({ searchId: session.value.id })
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not start fresh research.'
  }
}

function expireReview() {
  if (!session.value) return
  try {
    actions.expireRecommendationReview(session.value.id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not conclude this review.'
  }
}

function resetWorkspace() {
  actions.resetWorkspace()
  resetOpen.value = false
}
</script>

<template>
  <div class="min-h-dvh bg-transparent text-thread-ink">
    <ThreadOnboarding v-if="!profile" @save="saveProfile" />
    <template v-else>
      <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-thread-ink focus:px-4 focus:py-3 focus:text-white">Skip to shopping</a>
      <ThreadHeader :profile="profile" :cart-count="cartSummary.itemCount" @open-cart="cartOpen = true" @edit-profile="profileOpen = true" @reset="resetOpen = true" />
      <main id="main-content" class="mx-auto max-w-[1920px] px-4 pb-20 pt-10 sm:px-7 sm:pt-14 lg:px-10 lg:pt-16 2xl:px-12">
        <section class="max-w-5xl">
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-thread-accent">Your personal style workspace</p>
          <h1 class="mt-4 max-w-4xl font-editorial text-5xl leading-[0.94] tracking-[-0.025em] sm:text-7xl lg:text-[88px]">What are we dressing for, <span class="italic">{{ profile.name }}</span>?</h1>
          <p class="mt-7 max-w-2xl text-base leading-7 text-thread-muted sm:text-lg">Bring a trip, an event, or a wardrobe gap. Rove shapes it into a considered edit you can refine, save, and shop across real retailers.</p>
        </section>

        <p v-if="actionError" role="alert" class="mt-6 border-l-2 border-thread-danger pl-3 text-sm text-thread-danger">{{ actionError }}</p>

        <section class="mt-14 sm:mt-20" aria-labelledby="results-heading">
          <div class="mb-6 flex flex-col gap-4 border-b border-thread-line pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0">
              <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]" :class="hasCurrentMission ? 'text-thread-accent' : 'text-thread-muted'">
                <LoaderCircle v-if="isSearching" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <Sparkles v-else class="h-3.5 w-3.5" aria-hidden="true" />
                <template v-if="hasCurrentMission">
                  Current mission<template v-if="replacementCount"> · Replacing {{ replacementCount }} {{ replacementCount === 1 ? 'item' : 'items' }}</template>
                </template>
                <template v-else>No current mission</template>
              </p>
              <h2 id="results-heading" class="mt-1 max-w-6xl font-editorial text-4xl leading-tight sm:text-5xl">
                {{ hasCurrentMission ? `“${currentPrompt}”` : 'Ready when you are.' }}
              </h2>
              <p v-if="hasCurrentMission && replacementCount" class="mt-3 max-w-3xl text-sm leading-6 text-thread-muted">Rove is keeping {{ session?.replacementContext?.preservedProducts.length ?? 0 }} accepted pieces visible and researching only the {{ replacementCount }} marked for replacement.</p>
            </div>
            <p v-if="hasCurrentMission" class="shrink-0 text-xs tabular-nums text-thread-muted">
              <strong class="font-medium text-thread-ink">{{ products.length }} ranked</strong>
              <span v-if="filteredProducts.length !== products.length"> · {{ filteredProducts.length }} shown</span>
            </p>
          </div>

          <EmptyState
            v-if="!hasCurrentMission"
            :title="savedEntries.length ? 'Your last mission is saved below.' : 'Nothing is being researched right now.'"
            :description="savedEntries.length ? 'Saved products and retailer links remain filterable in your mission library. Start a new brief whenever you want a separate current edit.' : 'Start a shopping mission and Rove will coordinate retailer research while preserving every grounded candidate here.'"
          />
          <template v-else-if="session">
            <ResearchProgress :session="session" @stop="stopResearch" />
            <RecommendationReview
              v-if="reviewPending"
              :session="session"
              @accept="acceptRecommendations"
              @replace="replaceRecommendations"
              @replace-all="replaceAllRecommendations"
              @research-again="researchAgain"
              @expired="expireReview"
            />
            <ProductFilters v-if="products.length" v-model="filters" :products="products" label="Filter current edit" class="mb-7" />
            <ProductGrid :products="filteredProducts" :loading="isSearching" @select="selectedProduct = $event" @add="quickAdd" />
            <EmptyState v-if="!isSearching && !products.length" title="No accepted candidates." description="This research pass ended without grounded products. Review target reasons in the research plan or start a broader mission." />
            <EmptyState v-else-if="products.length && !filteredProducts.length" title="No products match these filters." description="Clear one or more filters to see the other ranked candidates." />
            <p v-if="isSearching && products.length" class="mt-8 flex items-center gap-2 text-sm text-thread-muted" aria-live="polite">
              <LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" /> Research is still active—new candidates will be ranked into this feed.
            </p>
          </template>
        </section>

        <SavedMissionLibrary :entries="savedEntries" @select="selectedProduct = $event" @add="quickAdd" />
      </main>

      <footer class="border-t border-thread-line px-4 py-7 sm:px-7 lg:px-10 2xl:px-12">
        <div class="mx-auto flex max-w-[1824px] flex-col gap-3 text-xs text-thread-muted sm:flex-row sm:items-center sm:justify-between">
          <p>ROVE / Considered edits, real retailer links. Prices and stock are observations, not guarantees.</p>
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
