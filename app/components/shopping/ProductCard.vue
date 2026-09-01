<script setup lang="ts">
import { BadgeCheck, ExternalLink, Plus } from 'lucide-vue-next'
import type { Product } from '~/types/thread'
import { formatMoney } from '~/utils/money'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ select: []; add: [] }>()
const displayPrice = computed(() => props.product.priceCad !== undefined
  ? formatMoney(props.product.priceCad, 'CAD')
  : props.product.nativePrice !== undefined && props.product.nativeCurrency
    ? formatMoney(props.product.nativePrice, props.product.nativeCurrency)
    : 'Price unverified')
const observedLabel = computed(() => new Date(props.product.observedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }))
</script>

<template>
  <article class="group mb-3 inline-block w-full min-w-0 break-inside-avoid overflow-hidden border border-thread-line bg-thread-surface align-top sm:mb-4">
    <div class="relative overflow-hidden bg-thread-soft">
      <button type="button" class="block w-full cursor-pointer" :aria-label="`Inspect ${product.name}`" @click="emit('select')">
        <ProductImage
          :src="product.image"
          :alt="`${product.name}${product.brand ? ` by ${product.brand}` : ''}`"
          :width="product.imageWidth ?? 720"
          :height="product.imageHeight ?? 900"
          class="h-auto w-full object-cover transition duration-300 ease-out group-hover:scale-[1.015]"
          fallback-class="flex aspect-[4/3] w-full items-center justify-center bg-thread-soft text-thread-muted"
          :fallback-label="`Product preview unavailable for ${product.name}`"
        />
      </button>
      <button
        type="button"
        class="absolute bottom-2.5 right-2.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-thread-surface text-thread-ink shadow-soft transition hover:bg-thread-ink hover:text-white"
        :aria-label="product.stage === 'enriched' ? `Add or select variants for ${product.name}` : `Inspect ${product.name} before adding`"
        @click="emit('add')"
      >
        <Plus class="h-5 w-5" :stroke-width="1.7" aria-hidden="true" />
      </button>
    </div>

    <button type="button" class="block w-full cursor-pointer px-3 pb-2.5 pt-3 text-left" @click="emit('select')">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-thread-muted">{{ product.brand || product.retailer }}</p>
          <h3 class="mt-1 text-sm font-medium leading-5 text-thread-ink">{{ product.name }}</h3>
        </div>
        <p class="shrink-0 text-xs font-medium tabular-nums text-thread-ink">{{ displayPrice }}</p>
      </div>
      <p v-if="product.category || product.styleTags.length" class="mt-2 truncate text-[11px] capitalize text-thread-muted">
        {{ [product.category, ...product.styleTags.slice(0, 2)].filter(Boolean).map(value => value?.replace('-', ' ')).join(' · ') }}
      </p>
    </button>

    <div class="border-t border-thread-line px-3 py-2.5">
      <div class="flex min-w-0 items-center gap-2">
        <img :src="product.retailerLogo" alt="" width="20" height="20" class="h-5 w-5 rounded border border-thread-line bg-white object-contain p-0.5">
        <p class="min-w-0 truncate text-[10px] text-thread-muted">{{ product.retailer }}</p>
        <span class="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-thread-muted">
          <BadgeCheck class="h-3 w-3" aria-hidden="true" />
          {{ product.source === 'agent' ? 'Agent sourced' : 'Fixture' }}
        </span>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2">
        <p class="truncate text-[10px] text-thread-muted">{{ product.stage === 'candidate' ? 'Candidate' : product.availability.replace('-', ' ') }} · {{ observedLabel }}</p>
        <a :href="product.url" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-8 shrink-0 items-center gap-1 text-[10px] font-medium underline decoration-thread-line underline-offset-4 transition hover:text-thread-accent" :aria-label="`View ${product.name} at ${product.retailer}`">
          Retailer <ExternalLink class="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  </article>
</template>
