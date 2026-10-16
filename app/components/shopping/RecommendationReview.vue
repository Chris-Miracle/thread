<script setup lang="ts">
import { Check, CheckCircle2, RefreshCw, Timer } from 'lucide-vue-next'
import { getSessionCollectionProducts } from '~/domain/research/collection'
import type { Product, SearchSession } from '~/types/thread'
import { formatMoney } from '~/utils/money'

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
  return getSessionCollectionProducts(props.session).filter(product => ids.has(product.id))
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
  <section v-if="review" class="rove-card overflow-hidden" aria-labelledby="recommendation-review-title">
    <template v-if="review.status === 'pending'">
      <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div>
          <h3 id="recommendation-review-title" class="rove-headline text-[24px] leading-tight sm:text-[28px]">Does this edit feel right?</h3>
          <p class="mt-1.5 max-w-xl text-pretty text-[15px] leading-[1.5] text-thread-muted">Tap anything you’d like swapped. The rest stays.</p>
        </div>
        <div class="flex h-9 shrink-0 items-center gap-2 self-start rounded-full bg-thread-canvas px-3.5 text-[13px] tabular-nums" aria-live="polite">
          <Timer class="h-4 w-4 text-thread-accent" :stroke-width="2" aria-hidden="true" />
          <span><span class="font-semibold">{{ clock }}</span> <span class="text-thread-muted">left</span></span>
        </div>
      </div>

      <fieldset class="px-5 pb-6 sm:px-7">
        <legend class="sr-only">Mark items to replace</legend>
        <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 sm:gap-4">
          <button
            v-for="product in products"
            :key="product.id"
            type="button"
            class="group min-w-0 cursor-pointer text-left"
            :aria-pressed="selectedIds.includes(product.id)"
            :aria-label="`${selectedIds.includes(product.id) ? 'Keep' : 'Replace'} ${product.name}`"
            @click="toggleSelection(product.id)"
          >
            <span class="relative block overflow-hidden rounded-2xl bg-thread-well">
              <ProductImage :src="product.image" alt="" :width="240" :height="300" class="aspect-[4/5] w-full object-cover transition duration-300" :class="selectedIds.includes(product.id) ? 'scale-[0.94] rounded-xl opacity-40' : 'group-hover:scale-[1.02]'" fallback-class="flex aspect-[4/5] w-full items-center justify-center bg-thread-well text-thread-faint" />
              <span class="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full shadow-raised transition duration-200" :class="selectedIds.includes(product.id) ? 'bg-thread-ink text-thread-on-ink' : 'bg-thread-surface/90 text-thread-ink backdrop-blur'" aria-hidden="true">
                <RefreshCw v-if="selectedIds.includes(product.id)" class="h-3.5 w-3.5" :stroke-width="2.2" />
                <Check v-else class="h-3.5 w-3.5" :stroke-width="2.4" />
              </span>
              <span v-if="selectedIds.includes(product.id)" class="absolute inset-x-0 bottom-3 text-center text-[12px] font-semibold text-thread-ink">Swap</span>
            </span>
            <span class="mt-2 block truncate text-[13px] font-medium" :class="selectedIds.includes(product.id) ? 'text-thread-muted' : ''">{{ product.name }}</span>
            <span class="block truncate text-[12px] tabular-nums text-thread-muted">{{ product.retailer }}<template v-if="product.priceCad"> · {{ formatMoney(product.priceCad, 'CAD') }}</template></span>
          </button>
        </div>
      </fieldset>

      <div class="flex flex-col gap-4 border-t border-thread-line bg-thread-canvas/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p class="text-[13px] font-medium tabular-nums">Keeping {{ keptCount }}<template v-if="selectedIds.length"> · Swapping {{ selectedIds.length }}</template></p>
          <p class="mt-0.5 text-[12px] text-thread-muted">Everything is kept if the timer runs out.</p>
        </div>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <button type="button" class="h-11 cursor-pointer rounded-full px-4 text-[14px] font-medium text-thread-muted transition hover:bg-thread-fill hover:text-thread-ink" @click="emit('replaceAll')">Replace all</button>
          <button type="button" :class="selectedIds.length ? 'rove-btn-secondary' : 'rove-btn-primary'" @click="emit('accept')">
            <Check class="h-4 w-4" :stroke-width="2.2" aria-hidden="true" /> Keep all
          </button>
          <button v-if="selectedIds.length" type="button" class="rove-btn-primary" @click="emit('replace', [...selectedIds])">
            <RefreshCw class="h-4 w-4" :stroke-width="2.2" aria-hidden="true" /> Swap {{ selectedIds.length }}
          </button>
        </div>
      </div>
    </template>

    <div v-else-if="review.status === 'accepted'" class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
      <div class="flex items-start gap-3.5">
        <CheckCircle2 class="mt-0.5 h-6 w-6 shrink-0 text-thread-success" :stroke-width="1.9" aria-hidden="true" />
        <div>
          <h3 id="recommendation-review-title" class="text-[17px] font-semibold tracking-[-0.01em]">Edit saved</h3>
          <p class="mt-0.5 text-pretty text-[14px] leading-[1.5] text-thread-muted">It’s in your library below. Research again for new pieces in the same spirit.</p>
        </div>
      </div>
      <button type="button" class="rove-btn-secondary shrink-0" @click="emit('researchAgain')">
        <RefreshCw class="h-4 w-4" :stroke-width="2" aria-hidden="true" /> Research again
      </button>
    </div>
  </section>
</template>
