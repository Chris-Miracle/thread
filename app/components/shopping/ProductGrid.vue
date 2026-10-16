<script setup lang="ts">
import type { Product } from '~/types/thread'

defineProps<{ products: Product[]; loading?: boolean }>()
const emit = defineEmits<{ select: [product: Product]; add: [product: Product] }>()
</script>

<template>
  <div v-if="loading && !products.length" class="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-label="Research in progress">
    <div v-for="index in 10" :key="index" class="skeleton" :style="{ animationDelay: `${index * 80}ms` }">
      <div class="aspect-[4/5] rounded-[18px] bg-thread-well" />
      <div class="mt-3 h-2.5 w-14 rounded-full bg-thread-well" />
      <div class="mt-2 h-3 w-4/5 rounded-full bg-thread-well" />
      <div class="mt-2 h-3 w-12 rounded-full bg-thread-well" />
    </div>
  </div>
  <TransitionGroup v-else name="product-list" tag="div" class="grid grid-cols-2 items-stretch gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
    <ProductCard v-for="product in products" :key="product.id" :product="product" @select="emit('select', product)" @add="emit('add', product)" />
  </TransitionGroup>
</template>

<style scoped>
.skeleton { animation: breathe 1.6s ease-in-out infinite; }
@keyframes breathe { 50% { opacity: 0.55; } }
.product-list-enter-active { transition: opacity 360ms ease-out, transform 480ms cubic-bezier(0.32, 0.72, 0, 1); }
.product-list-enter-from { opacity: 0; transform: translateY(12px); }
</style>
