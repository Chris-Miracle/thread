<script setup lang="ts">
import { ArrowUpRight, Plus } from 'lucide-vue-next'
import type { Product } from '~/types/thread'
import { formatMoney } from '~/utils/money'
import { productLink, productProvenance } from '~/utils/productLinks'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ select: []; add: [] }>()
const displayPrice = computed(() => props.product.priceCad !== undefined
  ? formatMoney(props.product.priceCad, 'CAD')
  : props.product.nativePrice !== undefined && props.product.nativeCurrency
    ? formatMoney(props.product.nativePrice, props.product.nativeCurrency)
    : null)
const badge = computed(() => {
  if (props.product.availability === 'out-of-stock') return 'Sold out'
  if (props.product.availability === 'limited') return 'Low stock'
  return null
})
</script>

<template>
  <article class="group flex h-full w-full min-w-0 flex-col">
    <div class="relative overflow-hidden rounded-[18px] bg-thread-well">
      <button type="button" class="block w-full cursor-pointer" :aria-label="`Inspect ${product.name}`" @click="emit('select')">
        <ProductImage
          :src="product.image"
          :alt="`${product.name}${product.brand ? ` by ${product.brand}` : ''}`"
          :width="product.imageWidth ?? 720"
          :height="product.imageHeight ?? 900"
          class="aspect-[4/5] w-full object-cover mix-blend-multiply transition dark:mix-blend-normal dark:brightness-[0.94] duration-700 ease-sheet group-hover:scale-[1.03]"
          fallback-class="flex aspect-[4/5] w-full items-center justify-center bg-thread-well text-thread-faint"
          :fallback-label="`Product preview unavailable for ${product.name}`"
        />
      </button>
      <span v-if="badge" class="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-thread-surface/90 px-2 py-[3px] text-[11px] font-medium text-thread-ink shadow-hairline backdrop-blur">{{ badge }}</span>
      <button
        type="button"
        class="absolute bottom-2.5 right-2.5 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-thread-surface/90 text-thread-ink shadow-raised backdrop-blur transition duration-200 hover:bg-thread-ink hover:text-thread-on-ink active:scale-90"
        :aria-label="product.stage === 'enriched' ? `Add or select variants for ${product.name}` : `Inspect ${product.name} before adding`"
        @click="emit('add')"
      >
        <Plus class="h-[18px] w-[18px]" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>

    <button type="button" class="mt-3 block w-full flex-1 cursor-pointer px-0.5 text-left" @click="emit('select')">
      <p class="truncate text-[12px] text-thread-muted">{{ product.brand || product.retailer }}</p>
      <h3 class="mt-0.5 line-clamp-2 text-[14px] font-medium leading-[1.35] text-thread-ink">{{ product.name }}</h3>
      <p class="mt-1 text-[14px] tabular-nums" :class="displayPrice ? 'text-thread-ink' : 'text-thread-muted'">{{ displayPrice ?? 'Price unverified' }}</p>
    </button>

    <div class="mt-2 flex min-w-0 items-center gap-1.5 px-0.5">
      <img :src="product.retailerLogo" alt="" width="16" height="16" class="h-4 w-4 shrink-0 rounded-[4px] bg-white object-contain shadow-hairline">
      <p class="min-w-0 truncate text-[12px] text-thread-muted" :title="productProvenance(product, true)">{{ product.retailer }}</p>
      <a :href="productLink(product)" target="_blank" rel="noopener noreferrer" class="-my-1 -mr-1.5 ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-thread-muted transition hover:bg-thread-fill hover:text-thread-ink" :aria-label="`View ${product.name} at ${product.retailer}`">
        <ArrowUpRight class="h-3.5 w-3.5" :stroke-width="2" aria-hidden="true" />
      </a>
    </div>
  </article>
</template>
