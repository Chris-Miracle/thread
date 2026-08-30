<script setup lang="ts">
import type { Product } from '~/types/thread'

defineProps<{ products: Product[]; loading?: boolean }>()
const emit = defineEmits<{ select: [product: Product]; add: [product: Product] }>()
</script>

<template>
  <div v-if="loading && !products.length" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading products">
    <div v-for="index in 8" :key="index" class="animate-pulse">
      <div class="aspect-[4/5] bg-thread-soft" />
      <div class="mt-4 h-3 w-16 bg-thread-soft" />
      <div class="mt-2 h-4 w-3/4 bg-thread-soft" />
    </div>
  </div>
  <TransitionGroup v-else name="product-list" tag="div" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <ProductCard v-for="product in products" :key="product.id" :product="product" @select="emit('select', product)" @add="emit('add', product)" />
  </TransitionGroup>
</template>

<style scoped>
.product-list-enter-active { transition: opacity 240ms ease-out, transform 240ms ease-out; }
.product-list-enter-from { opacity: 0; transform: translateY(8px); }
</style>
