<script setup lang="ts">
import { BadgeCheck, ExternalLink, Plus } from 'lucide-vue-next'
import type { Product } from '~/types/thread'
import { formatMoney } from '~/utils/money'

defineProps<{ product: Product }>()
const emit = defineEmits<{ select: []; add: [] }>()
</script>

<template>
  <article class="group min-w-0 border border-thread-line bg-thread-surface">
    <div class="flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5">
      <div class="flex min-w-0 items-center gap-2.5">
        <img :src="product.retailerLogo" :alt="`${product.retailer} logo`" width="28" height="28" class="h-7 w-7 rounded-md border border-thread-line bg-white object-contain p-0.5">
        <div class="min-w-0">
          <p class="truncate text-xs font-semibold text-thread-ink">{{ product.retailer }}</p>
          <p class="mt-0.5 flex items-center gap-1 text-[10px] text-thread-muted"><BadgeCheck class="h-3 w-3" aria-hidden="true" /> {{ product.source === 'agent' ? 'Verified by agent' : 'Curated by Thread' }}</p>
        </div>
      </div>
      <span class="shrink-0 text-[10px] uppercase tracking-[0.1em] text-thread-muted">{{ product.availability.replace('-', ' ') }}</span>
    </div>
    <div class="relative aspect-[4/5] overflow-hidden bg-thread-soft">
      <button type="button" class="block h-full w-full cursor-pointer" :aria-label="`View ${product.name}`" @click="emit('select')">
        <img
          :src="product.image"
          :alt="`${product.name} by ${product.brand}`"
          width="720"
          height="900"
          loading="lazy"
          class="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]"
          referrerpolicy="no-referrer"
        >
      </button>
      <button
        type="button"
        class="absolute bottom-3 right-3 flex h-11 w-11 cursor-pointer items-center justify-center bg-thread-surface text-thread-ink shadow-soft transition hover:bg-thread-ink hover:text-white"
        :aria-label="`Add ${product.name} to your Thread`"
        @click="emit('add')"
      >
        <Plus class="h-5 w-5" :stroke-width="1.7" aria-hidden="true" />
      </button>
    </div>
    <button type="button" class="block w-full cursor-pointer px-3.5 pb-3 pt-4 text-left" @click="emit('select')">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-[0.15em] text-thread-muted">{{ product.brand }}</p>
          <h3 class="mt-1 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-thread-ink">{{ product.name }}</h3>
        </div>
        <p class="shrink-0 text-sm tabular-nums text-thread-ink">{{ formatMoney(product.price, product.currency) }}</p>
      </div>
      <p class="mt-2 truncate text-xs capitalize text-thread-muted">{{ product.styleTags.slice(0, 2).map(tag => tag.replace('-', ' ')).join(' · ') }}</p>
    </button>
    <div class="flex items-center justify-between border-t border-thread-line px-3.5 py-2.5">
      <p class="text-[10px] text-thread-muted">Observed {{ new Date(product.observedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) }}</p>
      <a :href="product.url" target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center gap-1.5 text-xs font-medium underline decoration-thread-line underline-offset-4 transition hover:text-thread-accent" :aria-label="`View ${product.name} at ${product.retailer}`">
        Shop product <ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  </article>
</template>
