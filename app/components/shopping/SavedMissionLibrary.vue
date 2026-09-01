<script setup lang="ts">
import { Archive, CalendarDays, CheckCircle2 } from 'lucide-vue-next'
import { filterProducts } from '~/domain/productFilters'
import { emptyResultFilters, type Product, type ResultFilters, type SavedResearchEntry } from '~/types/thread'
import { formatMoney } from '~/utils/money'

const props = defineProps<{ entries: SavedResearchEntry[] }>()
const emit = defineEmits<{ select: [product: Product]; add: [product: Product] }>()
const selectedSearchId = ref('')
const filters = ref<ResultFilters>(emptyResultFilters())

const selectedEntry = computed(() => props.entries.find(entry => entry.searchId === selectedSearchId.value) ?? props.entries[0] ?? null)
const filteredProducts = computed(() => selectedEntry.value
  ? filterProducts(selectedEntry.value.products, filters.value)
  : [])
const subtotalCad = computed(() => selectedEntry.value?.products.reduce((total, product) => total + (product.priceCad ?? 0), 0) ?? 0)
const acceptedLabel = computed(() => selectedEntry.value
  ? new Date(selectedEntry.value.acceptedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  : '')

watch(() => props.entries.map(entry => entry.searchId).join('|'), () => {
  if (!props.entries.some(entry => entry.searchId === selectedSearchId.value)) {
    selectedSearchId.value = props.entries[0]?.searchId ?? ''
  }
}, { immediate: true })

watch(selectedSearchId, () => { filters.value = emptyResultFilters() })
</script>

<template>
  <section v-if="entries.length" class="mt-16 border-t-2 border-thread-ink pt-8 sm:mt-24 sm:pt-10" aria-labelledby="saved-missions-title">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-green-700">
          <Archive class="h-4 w-4" aria-hidden="true" /> Saved locally
        </p>
        <h2 id="saved-missions-title" class="mt-2 font-editorial text-4xl leading-tight sm:text-5xl">Your mission library</h2>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-thread-muted">Completed missions are not active research. Their accepted products and retailer links stay here for filtering, comparison, and adding to Your Thread.</p>
      </div>
      <p class="text-xs tabular-nums text-thread-muted">{{ entries.length }} saved {{ entries.length === 1 ? 'mission' : 'missions' }}</p>
    </div>

    <div class="thread-scrollbar mt-6 flex gap-2 overflow-x-auto pb-2" role="navigation" aria-label="Saved missions">
      <button
        v-for="entry in entries"
        :key="entry.searchId"
        type="button"
        class="min-h-20 w-72 shrink-0 cursor-pointer border p-3 text-left transition"
        :class="entry.searchId === selectedEntry?.searchId ? 'border-thread-ink bg-thread-ink text-white' : 'border-thread-line bg-thread-surface hover:border-thread-ink'"
        :aria-current="entry.searchId === selectedEntry?.searchId ? 'true' : undefined"
        @click="selectedSearchId = entry.searchId"
      >
        <span class="block truncate text-xs font-medium">{{ entry.prompt }}</span>
        <span class="mt-2 block text-[11px] opacity-70">{{ entry.products.length }} accepted · {{ new Date(entry.acceptedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) }}</span>
      </button>
    </div>

    <article v-if="selectedEntry" class="mt-5 border border-thread-line bg-thread-surface p-5 sm:p-7">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-green-700">
            <CheckCircle2 class="h-4 w-4" aria-hidden="true" /> Saved mission · Not running
          </p>
          <h3 class="mt-3 max-w-5xl font-editorial text-3xl leading-tight sm:text-4xl">“{{ selectedEntry.prompt }}”</h3>
        </div>
        <dl class="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 border-l border-thread-line pl-5 text-xs">
          <div>
            <dt class="text-thread-muted">Accepted</dt>
            <dd class="mt-1 flex items-center gap-1.5 font-medium"><CalendarDays class="h-3.5 w-3.5" aria-hidden="true" /> {{ acceptedLabel }}</dd>
          </div>
          <div>
            <dt class="text-thread-muted">Saved edit</dt>
            <dd class="mt-1 font-medium tabular-nums">{{ selectedEntry.products.length }} items · {{ formatMoney(subtotalCad, 'CAD') }}</dd>
          </div>
        </dl>
      </div>

      <ProductFilters v-model="filters" :products="selectedEntry.products" label="Filter saved products" class="mb-7 mt-7" />
      <ProductGrid :products="filteredProducts" @select="emit('select', $event)" @add="emit('add', $event)" />
      <EmptyState v-if="selectedEntry.products.length && !filteredProducts.length" title="No saved products match these filters." description="Clear one or more filters to see the rest of this saved mission." />
    </article>
  </section>
</template>
