<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { filterProducts } from '~/domain/productFilters'
import type { ProfileInput } from '~/domain/profile/profile'
import { getProductVariantPolicy } from '~/domain/products/productVariants'
import { getSessionCollectionProducts, getSessionRootPrompt } from '~/domain/research/collection'
import { MAX_INSPIRATION_ITEMS } from '~/domain/threadActions'
import { emptyResultFilters, type Product, type CartSelection } from '~/types/thread'

const { profile } = useThreadProfile()
const { search } = useThreadSearch()
const { inspiration } = useThreadInspiration()
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
const greeting = computed(() => {
  const hour = new Date().getHours()
  return hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
})
const savedEntries = computed(() => {
  search.value.activeSearch?.revision
  return actions.getResearchHistory().entries
})

watch(() => session.value?.id, () => { filters.value = emptyResultFilters() })
watch(() => session.value?.revision, () => {
  if (selectedProduct.value) selectedProduct.value = actions.getProductById(selectedProduct.value.id) ?? selectedProduct.value
})

function saveProfile(input: ProfileInput) {
  actions.saveStyleProfile(input)
  profileOpen.value = false
}

function quickAdd(product: Product) {
  actionError.value = ''
  const variantPolicy = getProductVariantPolicy(product)
  if (product.commerce || product.stage !== 'enriched' || variantPolicy.requiresSize || variantPolicy.requiresColor) {
    selectedProduct.value = product
    return
  }
  try {
    actions.addToCart(product.id, {}, 'human')
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not add this product.'
  }
}

function addFromDetail(options: CartSelection) {
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
  <div class="min-h-dvh text-thread-ink">
    <ThreadOnboarding v-if="!profile" @save="saveProfile" />
    <template v-else>
      <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-thread-ink focus:px-4 focus:py-2.5 focus:text-[14px] focus:text-thread-on-ink">Skip to shopping</a>
      <ThreadHeader :profile="profile" :cart-count="cartSummary.itemCount" @open-cart="cartOpen = true" @edit-profile="profileOpen = true" @reset="resetOpen = true" />
      <main id="main-content" class="mx-auto max-w-[1440px] px-4 pb-24 sm:px-6 lg:px-8">
        <section class="pt-12 sm:pt-20 lg:pt-24">
          <h1 class="rove-headline max-w-4xl text-balance text-[40px] leading-[1.05] sm:text-[56px] lg:text-[64px]">
            {{ greeting }}, {{ profile.name }}.
            <span class="text-thread-muted">What are we dressing for?</span>
          </h1>
          <p class="mt-5 max-w-xl text-pretty text-[17px] leading-[1.5] text-thread-muted sm:text-[19px]">Tell your agent about a trip, an event or a gap in your wardrobe. Rove turns it into an edit you can refine and shop.</p>
        </section>

        <p v-if="actionError" role="alert" class="mt-8 rounded-2xl bg-thread-danger/[0.07] px-4 py-3 text-[14px] text-thread-danger">{{ actionError }}</p>

        <InspirationBoard
          v-if="inspiration.items.some(item => item.source === 'upload')"
          :items="inspiration.items.filter(item => item.source === 'upload')"
          :limit="MAX_INSPIRATION_ITEMS"
          :disabled="reviewPending"
          @remove="actions.removeInspiration"
        />

        <section class="mt-14 sm:mt-20" aria-labelledby="results-heading">
          <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0">
              <p v-if="hasCurrentMission" class="mb-3 inline-flex h-7 items-center gap-2 rounded-full bg-thread-surface px-3 text-[12px] font-medium shadow-hairline">
                <span class="relative flex h-2 w-2" aria-hidden="true">
                  <span v-if="isSearching" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-thread-accent opacity-60" />
                  <span class="relative inline-flex h-2 w-2 rounded-full" :class="isSearching ? 'bg-thread-accent' : 'bg-thread-ink'" />
                </span>
                {{ isSearching ? 'Researching' : 'Ready for review' }}<template v-if="replacementCount"><span class="text-thread-muted"> · Replacing {{ replacementCount }}</span></template>
              </p>
              <h2 id="results-heading" class="rove-headline max-w-5xl text-balance text-[28px] leading-[1.12] sm:text-[36px]">
                {{ hasCurrentMission ? `“${currentPrompt}”` : 'Ready when you are.' }}
              </h2>
            </div>
            <p v-if="hasCurrentMission && products.length" class="shrink-0 text-[13px] tabular-nums text-thread-muted">
              {{ products.length }} {{ products.length === 1 ? 'piece' : 'pieces' }}<template v-if="filteredProducts.length !== products.length"> · {{ filteredProducts.length }} shown</template>
            </p>
          </div>

          <EmptyState
            v-if="!hasCurrentMission"
            :title="savedEntries.length ? 'Your last edit is in your library.' : 'Nothing in progress'"
            :description="savedEntries.length ? 'Start a new brief with your agent whenever you’re ready.' : 'Ask your agent to start a shopping mission. Pieces from real retailers will appear here as they’re found.'"
          />
          <div v-else-if="session" class="space-y-6">
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
            <div class="pt-2">
              <ProductFilters v-if="products.length" v-model="filters" :products="products" label="Filter current edit" class="mb-7" />
              <ProductGrid :products="filteredProducts" :loading="isSearching" @select="selectedProduct = $event" @add="quickAdd" />
              <EmptyState v-if="!isSearching && !products.length" title="Nothing made the cut" description="This pass ended without pieces worth keeping. Try a broader brief with your agent.">
                <template #icon><Search class="h-5 w-5" :stroke-width="1.7" /></template>
              </EmptyState>
              <EmptyState v-else-if="products.length && !filteredProducts.length" title="No matches" description="Clear a filter to see the other pieces." />
              <p v-if="isSearching && products.length" class="mt-10 flex items-center justify-center gap-2.5 text-[13px] text-thread-muted" aria-live="polite">
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-thread-accent" aria-hidden="true" /> Still searching — new pieces will appear here.
              </p>
            </div>
          </div>
        </section>

        <SavedMissionLibrary :entries="savedEntries" @select="selectedProduct = $event" @add="quickAdd" />
      </main>

      <footer class="border-t border-thread-line">
        <div class="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-[12px] text-thread-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Rove · Real retailer links. Prices and stock are observations, not guarantees.</p>
          <WebMCPStatus :supported="webmcpStatus.supported" :registered="webmcpStatus.registered" />
        </div>
      </footer>

      <CartDrawer v-if="cartOpen" :cart="cartSummary" @close="cartOpen = false" @remove="actions.removeFromCart" @clear="actions.clearCart" />
      <ProductDetail v-if="selectedProduct" :product="selectedProduct" :error="actionError" @close="selectedProduct = null" @add="addFromDetail" />
      <ResetWorkspaceDialog v-if="resetOpen" @cancel="resetOpen = false" @confirm="resetWorkspace" />
      <div v-if="profileOpen" class="fixed inset-0 z-50 overflow-y-auto bg-thread-canvas"><ThreadOnboarding :profile="profile" editing @save="saveProfile" @cancel="profileOpen = false" /></div>
      <ThreadDebugPanel v-if="showDebug" />
    </template>
    <ThreadToast :toast="toast" @dismiss="dismissToast" />
  </div>
</template>
