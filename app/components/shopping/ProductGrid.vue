<script setup lang="ts">
import type { Product } from '~/types/thread'

const props = defineProps<{ products: Product[]; loading?: boolean }>()
const emit = defineEmits<{ select: [product: Product]; add: [product: Product] }>()

const resultGridClass = computed(() => {
  if (props.products.length === 1) return 'grid-cols-1 max-w-sm'
  if (props.products.length === 2) return 'grid-cols-2 mx-auto w-full max-w-4xl'
  if (props.products.length === 3) return 'grid-cols-2 sm:grid-cols-3'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
})
</script>

<template>
  <div v-if="loading && !products.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-label="Research in progress">
    <div v-for="index in 12" :key="index" class="rove-glass-card animate-pulse overflow-hidden rounded-[1.4rem] border border-thread-line bg-thread-surface p-2">
      <div class="aspect-[4/5] rounded-[1rem] bg-thread-soft" />
      <div class="mt-3 h-3 w-16 bg-thread-soft" />
      <div class="mt-2 h-4 w-3/4 bg-thread-soft" />
    </div>
  </div>
  <TransitionGroup v-else name="product-list" tag="div" class="grid items-stretch gap-3 sm:gap-4" :class="resultGridClass">
    <ProductCard v-for="product in products" :key="product.id" :product="product" @select="emit('select', product)" @add="emit('add', product)" />
  </TransitionGroup>
</template>

<style scoped>
.product-list-enter-active { transition: opacity 220ms ease-out, transform 220ms ease-out; }
.product-list-enter-from { opacity: 0; transform: translateY(8px); }
</style>
