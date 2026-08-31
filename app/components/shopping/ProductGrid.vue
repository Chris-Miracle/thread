<script setup lang="ts">
import type { Product } from '~/types/thread'

defineProps<{ products: Product[]; loading?: boolean }>()
const emit = defineEmits<{ select: [product: Product]; add: [product: Product] }>()
</script>

<template>
  <div v-if="loading && !products.length" class="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6" aria-label="Research in progress">
    <div v-for="index in 12" :key="index" class="mb-3 inline-block w-full break-inside-avoid animate-pulse border border-thread-line bg-thread-surface p-2">
      <div class="bg-thread-soft" :class="index % 3 === 0 ? 'aspect-[3/4]' : index % 2 === 0 ? 'aspect-square' : 'aspect-[4/5]'" />
      <div class="mt-3 h-3 w-16 bg-thread-soft" />
      <div class="mt-2 h-4 w-3/4 bg-thread-soft" />
    </div>
  </div>
  <TransitionGroup v-else name="product-list" tag="div" class="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 xl:columns-5 2xl:columns-6">
    <ProductCard v-for="product in products" :key="product.id" :product="product" @select="emit('select', product)" @add="emit('add', product)" />
  </TransitionGroup>
</template>

<style scoped>
.product-list-enter-active { transition: opacity 220ms ease-out, transform 220ms ease-out; }
.product-list-enter-from { opacity: 0; transform: translateY(8px); }
</style>
