<script setup lang="ts">
import { Check, RefreshCw, TimerReset } from 'lucide-vue-next'
import type { Product, SearchSession } from '~/types/thread'

const props = defineProps<{ session: SearchSession }>()
const emit = defineEmits<{
  accept: []
  replace: [productIds: string[]]
  replaceAll: []
  researchAgain: []
  expired: []
}>()

const now = ref(Date.now())
const selectedIds = ref<string[]>([])
const expiryEmitted = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const review = computed(() => props.session.recommendationReview)
const products = computed<Product[]>(() => {
  const ids = new Set(review.value?.productIds ?? [])
  return props.session.products.filter(product => ids.has(product.id))
})
const remainingSeconds = computed(() => review.value?.status === 'pending'
  ? Math.max(0, Math.ceil((Date.parse(review.value.deadlineAt) - now.value) / 1_000))
  : 0)
const clock = computed(() => {
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})
const keptCount = computed(() => Math.max(0, products.value.length - selectedIds.value.length))

function toggleSelection(productId: string) {
  selectedIds.value = selectedIds.value.includes(productId)
    ? selectedIds.value.filter(id => id !== productId)
    : [...selectedIds.value, productId]
}

watch(() => props.session.id, () => {
  selectedIds.value = []
  expiryEmitted.value = false
})

watch(() => review.value?.productIds.join('|'), () => {
  const presented = new Set(review.value?.productIds ?? [])
  selectedIds.value = selectedIds.value.filter(productId => presented.has(productId))
})

watch(remainingSeconds, (seconds) => {
  if (review.value?.status === 'pending' && seconds === 0 && !expiryEmitted.value) {
    expiryEmitted.value = true
    emit('expired')
  }
}, { immediate: true })

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section v-if="review" class="mb-7 border border-thread-ink bg-thread-surface" aria-labelledby="recommendation-review-title">
    <template v-if="review.status === 'pending'">
      <div class="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-7">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.16em] text-thread-accent">Your call</p>
          <h3 id="recommendation-review-title" class="mt-2 font-editorial text-3xl leading-tight sm:text-4xl">Do these recommendations feel right?</h3>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-thread-muted">Every item is kept by default. Mark only the pieces you want removed from this edit; everything else stays visible while fresh replacements are researched.</p>
        </div>
        <div class="flex min-w-36 items-center gap-2 border border-thread-line bg-thread-canvas px-4 py-3 text-sm tabular-nums" aria-live="polite">
          <TimerReset class="h-4 w-4 text-thread-accent" aria-hidden="true" />
          <span><strong class="font-medium">{{ clock }}</strong> to confirm</span>
        </div>
      </div>

      <fieldset class="border-t border-thread-line px-5 py-4 lg:px-7">
        <legend class="px-1 text-xs font-medium uppercase tracking-[0.14em] text-thread-muted">Mark only items to replace</legend>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="product in products"
            :key="product.id"
            type="button"
            class="flex min-h-20 cursor-pointer items-center gap-3 border p-3 text-left transition"
            :class="selectedIds.includes(product.id) ? 'border-thread-danger bg-red-50' : 'border-thread-line bg-thread-canvas hover:border-thread-ink'"
            :aria-pressed="selectedIds.includes(product.id)"
            :aria-label="`${selectedIds.includes(product.id) ? 'Keep' : 'Replace'} ${product.name}`"
            @click="toggleSelection(product.id)"
          >
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border" :class="selectedIds.includes(product.id) ? 'border-thread-danger bg-thread-danger text-white' : 'border-thread-line bg-thread-surface text-green-700'">
              <RefreshCw v-if="selectedIds.includes(product.id)" class="h-3.5 w-3.5" aria-hidden="true" />
              <Check v-else class="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <ProductImage :src="product.image" alt="" :width="48" :height="56" class="h-14 w-12 shrink-0 bg-thread-soft object-cover" fallback-class="flex h-14 w-12 shrink-0 items-center justify-center bg-thread-soft text-thread-muted" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ product.name }}</p>
              <p class="mt-1 text-xs text-thread-muted">{{ product.retailer }}<template v-if="product.priceCad"> · CAD {{ product.priceCad.toFixed(2) }}</template></p>
              <p class="mt-1 text-[10px] font-medium uppercase tracking-[0.12em]" :class="selectedIds.includes(product.id) ? 'text-thread-danger' : 'text-green-700'">
                {{ selectedIds.includes(product.id) ? 'Will be replaced' : 'Keeping this item' }}
              </p>
            </div>
          </button>
        </div>
      </fieldset>

      <div class="flex flex-col gap-2 border-t border-thread-line p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:px-7">
        <div>
          <p class="text-xs font-medium text-thread-ink">Keeping {{ keptCount }} · Replacing {{ selectedIds.length }}</p>
          <p class="mt-1 text-xs leading-5 text-thread-muted">No response saves the full set as accepted when the timer ends.</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <button type="button" class="min-h-11 border border-thread-line px-4 text-xs font-medium transition hover:border-thread-ink" @click="emit('replaceAll')">
            Replace the full set
          </button>
          <button type="button" class="min-h-11 border border-thread-ink px-4 text-xs font-medium transition enabled:hover:bg-thread-soft disabled:cursor-not-allowed disabled:opacity-40" :disabled="!selectedIds.length" @click="emit('replace', [...selectedIds])">
            Find replacements<span v-if="selectedIds.length"> ({{ selectedIds.length }})</span>
          </button>
          <button type="button" class="flex min-h-11 items-center justify-center gap-2 bg-thread-ink px-5 text-xs font-medium text-white transition hover:opacity-90" @click="emit('accept')">
            <Check class="h-4 w-4" aria-hidden="true" /> Keep all items
          </button>
        </div>
      </div>
    </template>

    <div v-else-if="review.status === 'accepted'" class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-7">
      <div>
        <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-green-700"><Check class="h-4 w-4" aria-hidden="true" /> Saved locally</p>
        <h3 id="recommendation-review-title" class="mt-2 font-editorial text-3xl">Your edit is confirmed.</h3>
        <p class="mt-2 text-sm leading-6 text-thread-muted">The prompt and accepted products are saved. Another pass will keep the useful style cues without repeating prior product links.</p>
      </div>
      <button type="button" class="flex min-h-11 shrink-0 items-center justify-center gap-2 border border-thread-ink px-5 text-xs font-medium transition hover:bg-thread-soft" @click="emit('researchAgain')">
        <RefreshCw class="h-4 w-4" aria-hidden="true" /> Research again
      </button>
    </div>
  </section>
</template>
