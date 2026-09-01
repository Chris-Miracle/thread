<script setup lang="ts">
import { RotateCcw, SlidersHorizontal } from 'lucide-vue-next'
import { PRODUCT_CATEGORIES, emptyResultFilters, type Product, type ResultFilters } from '~/types/thread'

const props = withDefaults(defineProps<{ products: Product[]; modelValue: ResultFilters; label?: string }>(), {
  label: 'Filter products',
})
const emit = defineEmits<{ 'update:modelValue': [filters: ResultFilters] }>()

const retailers = computed(() => [...new Set(props.products.map(product => product.retailer))].sort())
const brands = computed(() => [...new Set(props.products.map(product => product.brand).filter((brand): brand is string => Boolean(brand)))].sort())
const hasFilters = computed(() => JSON.stringify(props.modelValue) !== JSON.stringify(emptyResultFilters()))

function update<Key extends keyof ResultFilters>(key: Key, value: ResultFilters[Key]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="border-y border-thread-line py-4" :aria-label="label">
    <div class="mb-3 flex items-center justify-between gap-4">
      <p class="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-thread-muted">
        <SlidersHorizontal class="h-4 w-4" aria-hidden="true" /> {{ label }} · {{ products.length }} {{ products.length === 1 ? 'item' : 'items' }}
      </p>
      <button v-if="hasFilters" type="button" class="flex min-h-11 cursor-pointer items-center gap-1.5 text-xs text-thread-muted underline-offset-4 hover:text-thread-ink hover:underline" @click="emit('update:modelValue', emptyResultFilters())">
        <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
      </button>
    </div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <label class="text-xs text-thread-muted">Store
        <select :value="modelValue.retailer" class="mt-1 min-h-11 w-full border border-thread-line bg-thread-surface px-3 text-sm text-thread-ink" @change="update('retailer', ($event.target as HTMLSelectElement).value)">
          <option value="">All stores</option><option v-for="retailer in retailers" :key="retailer" :value="retailer">{{ retailer }}</option>
        </select>
      </label>
      <label class="text-xs text-thread-muted">Brand
        <select :value="modelValue.brand" class="mt-1 min-h-11 w-full border border-thread-line bg-thread-surface px-3 text-sm text-thread-ink" @change="update('brand', ($event.target as HTMLSelectElement).value)">
          <option value="">All brands</option><option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
        </select>
      </label>
      <label class="text-xs text-thread-muted">Category
        <select :value="modelValue.category" class="mt-1 min-h-11 w-full border border-thread-line bg-thread-surface px-3 text-sm capitalize text-thread-ink" @change="update('category', ($event.target as HTMLSelectElement).value as ResultFilters['category'])">
          <option value="">All categories</option><option v-for="category in PRODUCT_CATEGORIES" :key="category" :value="category">{{ category }}</option>
        </select>
      </label>
      <label class="text-xs text-thread-muted">Price (CAD)
        <select :value="modelValue.maxPriceCad ?? ''" class="mt-1 min-h-11 w-full border border-thread-line bg-thread-surface px-3 text-sm text-thread-ink" @change="update('maxPriceCad', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)">
          <option value="">Any verified price</option><option :value="50">Under 50</option><option :value="100">Under 100</option><option :value="150">Under 150</option><option :value="200">Under 200</option>
        </select>
      </label>
      <label class="col-span-2 text-xs text-thread-muted lg:col-span-1">Sort
        <select :value="modelValue.sort" class="mt-1 min-h-11 w-full border border-thread-line bg-thread-surface px-3 text-sm text-thread-ink" @change="update('sort', ($event.target as HTMLSelectElement).value as ResultFilters['sort'])">
          <option value="recommended">Recommended</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="newest">Newest observations</option>
        </select>
      </label>
    </div>
  </div>
</template>
