<script setup lang="ts">
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
  ? new Date(selectedEntry.value.acceptedAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
  : '')

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

watch(() => props.entries[0]?.searchId, (latestSearchId) => {
  selectedSearchId.value = latestSearchId ?? ''
}, { immediate: true })

watch(() => props.entries.map(entry => entry.searchId).join('|'), () => {
  if (!props.entries.some(entry => entry.searchId === selectedSearchId.value)) {
    selectedSearchId.value = props.entries[0]?.searchId ?? ''
  }
})

watch(selectedSearchId, () => { filters.value = emptyResultFilters() })
</script>

<template>
  <section v-if="entries.length" class="mt-20 border-t border-thread-line pt-12 sm:mt-28 sm:pt-16" aria-labelledby="saved-missions-title">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h2 id="saved-missions-title" class="rove-headline text-[32px] leading-tight sm:text-[40px]">Library</h2>
        <p class="mt-1 text-[15px] text-thread-muted">Edits you’ve kept, with every retailer link.</p>
      </div>
      <p class="shrink-0 text-[13px] tabular-nums text-thread-muted">{{ entries.length }} {{ entries.length === 1 ? 'edit' : 'edits' }}</p>
    </div>

    <div class="-mx-4 mt-7 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:px-0" role="navigation" aria-label="Saved edits">
      <button
        v-for="entry in entries"
        :key="entry.searchId"
        type="button"
        class="flex w-64 shrink-0 cursor-pointer flex-col rounded-[18px] bg-thread-surface p-3.5 text-left transition duration-200"
        :class="entry.searchId === selectedEntry?.searchId ? 'shadow-selected' : 'shadow-hairline hover:shadow-hairline-strong'"
        :aria-current="entry.searchId === selectedEntry?.searchId ? 'true' : undefined"
        @click="selectedSearchId = entry.searchId"
      >
        <span class="flex gap-1" aria-hidden="true">
          <ProductImage v-for="product in entry.products.slice(0, 4)" :key="product.id" :src="product.image" alt="" :width="80" :height="100" class="aspect-[4/5] w-10 rounded-lg bg-thread-well object-cover" fallback-class="aspect-[4/5] w-10 rounded-lg bg-thread-well text-transparent" />
        </span>
        <span class="mt-3 line-clamp-2 text-[14px] font-medium leading-[1.35]">{{ entry.prompt }}</span>
        <span class="mt-1 text-[12px] tabular-nums text-thread-muted">{{ entry.products.length }} {{ entry.products.length === 1 ? 'piece' : 'pieces' }} · {{ shortDate(entry.acceptedAt) }}</span>
      </button>
    </div>

    <article v-if="selectedEntry" class="mt-10">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 class="rove-headline max-w-4xl text-balance text-[24px] leading-tight sm:text-[28px]">{{ selectedEntry.prompt }}</h3>
        <p class="shrink-0 text-[13px] tabular-nums text-thread-muted">{{ acceptedLabel }} · {{ selectedEntry.products.length }} {{ selectedEntry.products.length === 1 ? 'piece' : 'pieces' }} · {{ formatMoney(subtotalCad, 'CAD') }}</p>
      </div>

      <ProductFilters v-model="filters" :products="selectedEntry.products" label="Filter saved products" class="mb-8 mt-6" />
      <ProductGrid :products="filteredProducts" @select="emit('select', $event)" @add="emit('add', $event)" />
      <EmptyState v-if="selectedEntry.products.length && !filteredProducts.length" title="No matches" description="Clear a filter to see the rest of this edit." />
    </article>
  </section>
</template>
