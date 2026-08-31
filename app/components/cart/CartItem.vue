<script setup lang="ts">
import { ExternalLink, Trash2 } from 'lucide-vue-next'
import type { CartItem } from '~/types/thread'
import { formatMoney } from '~/utils/money'

defineProps<{ item: CartItem }>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <article class="grid grid-cols-[80px_1fr_auto] gap-3 border-b border-thread-line py-4">
    <img v-if="item.product.image" :src="item.product.image" :alt="item.product.name" width="160" height="200" loading="lazy" class="h-24 w-20 bg-thread-soft object-cover">
    <div v-else class="h-24 w-20 bg-thread-soft" aria-hidden="true" />
    <div class="min-w-0 py-0.5">
      <h4 class="text-sm font-medium leading-5">{{ item.product.name }}</h4>
      <p v-if="item.color || item.size" class="mt-1 text-xs text-thread-muted">
        {{ [item.color, item.size].filter(Boolean).join(' / ') }}
      </p>
      <p class="mt-3 text-sm tabular-nums">{{ item.product.priceCad !== undefined ? formatMoney(item.product.priceCad, 'CAD') : 'Price unverified' }}</p>
      <a :href="item.product.url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex min-h-8 items-center gap-1 text-[11px] font-medium underline decoration-thread-line underline-offset-4">Buy at {{ item.product.retailer }} <ExternalLink class="h-3 w-3" aria-hidden="true" /></a>
    </div>
    <button type="button" class="flex h-11 w-11 cursor-pointer items-center justify-center text-thread-muted transition hover:text-thread-danger" :aria-label="`Remove ${item.product.name} from cart`" @click="emit('remove')">
      <Trash2 class="h-4 w-4" :stroke-width="1.7" aria-hidden="true" />
    </button>
  </article>
</template>
