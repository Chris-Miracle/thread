<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { PRODUCT_CATEGORIES, emptyResultFilters, type Product, type ResultFilters } from '~/types/thread'

const props = withDefaults(defineProps<{ products: Product[]; modelValue: ResultFilters; label?: string }>(), {
  label: 'Filter products',
})
const emit = defineEmits<{ 'update:modelValue': [filters: ResultFilters] }>()

const retailers = computed(() => [...new Set(props.products.map(product => product.retailer))].sort())
const brands = computed(() => [...new Set(props.products.map(product => product.brand).filter((brand): brand is string => Boolean(brand)))].sort())
const hasFilters = computed(() => Boolean(props.modelValue.retailer || props.modelValue.brand || props.modelValue.category || props.modelValue.maxPriceCad !== undefined))

const storeOptions = computed(() => [{ value: '', label: 'All stores' }, ...retailers.value.map(value => ({ value, label: value }))])
const brandOptions = computed(() => [{ value: '', label: 'All brands' }, ...brands.value.map(value => ({ value, label: value }))])
const categoryOptions = [{ value: '', label: 'All categories' }, ...PRODUCT_CATEGORIES.map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))]
const priceOptions = [
  { value: '', label: 'Any price' },
  ...[50, 100, 150, 200].map(value => ({ value, label: `Under $${value}` })),
]
const sortOptions = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
]

function update<Key extends keyof ResultFilters>(key: Key, value: ResultFilters[Key]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" :aria-label="label">
    <FilterPill label="Store" :value="modelValue.retailer" :options="storeOptions" :active="Boolean(modelValue.retailer)" @change="update('retailer', $event)" />
    <FilterPill v-if="brands.length" label="Brand" :value="modelValue.brand" :options="brandOptions" :active="Boolean(modelValue.brand)" @change="update('brand', $event)" />
    <FilterPill label="Category" :value="modelValue.category" :options="categoryOptions" :active="Boolean(modelValue.category)" @change="update('category', $event as ResultFilters['category'])" />
    <FilterPill label="Price (CAD)" :value="modelValue.maxPriceCad ?? ''" :options="priceOptions" :active="modelValue.maxPriceCad !== undefined" @change="update('maxPriceCad', $event ? Number($event) : undefined)" />
    <button v-if="hasFilters" type="button" class="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-[13px] font-medium text-thread-muted transition hover:bg-thread-fill hover:text-thread-ink" @click="emit('update:modelValue', { ...emptyResultFilters(), sort: modelValue.sort })">
      <X class="h-3.5 w-3.5" :stroke-width="2.2" aria-hidden="true" /> Clear
    </button>
    <div class="ml-auto flex shrink-0 items-center gap-2 pl-2">
      <span class="hidden text-[13px] text-thread-muted sm:inline" aria-hidden="true">Sort</span>
      <FilterPill label="Sort" :value="modelValue.sort" :options="sortOptions" @change="update('sort', $event as ResultFilters['sort'])" />
    </div>
  </div>
</template>
