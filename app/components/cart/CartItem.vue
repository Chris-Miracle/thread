<script setup lang="ts">
import { ArrowUpRight } from 'lucide-vue-next'
import { directCheckoutUrl } from '~/domain/cart/checkoutPlan'
import type { CartItem } from '~/types/thread'
import { formatMoney } from '~/utils/money'
import { productLink } from '~/utils/productLinks'

const props = withDefaults(defineProps<{ item: CartItem; showLink?: boolean }>(), { showLink: true })
const emit = defineEmits<{ remove: [] }>()
const checkoutUrl = computed(() => directCheckoutUrl(props.item))
const options = computed(() => props.item.selectedOptions?.map(option => option.label).join(' · ') || [props.item.color, props.item.size].filter(Boolean).join(' · '))
</script>

<template>
  <article class="flex gap-4 py-4">
    <ProductImage :src="item.product.image" :alt="item.product.name" :width="160" :height="200" class="h-[90px] w-[72px] shrink-0 rounded-xl bg-thread-well object-cover" fallback-class="flex h-[90px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-thread-well text-thread-faint" :fallback-label="`Product preview unavailable for ${item.product.name}`" />
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-start justify-between gap-3">
        <h4 class="line-clamp-2 text-[14px] font-medium leading-[1.35]">{{ item.product.name }}</h4>
        <p class="shrink-0 text-[14px] tabular-nums" :class="item.product.priceCad === undefined ? 'text-thread-muted' : ''">{{ item.product.priceCad !== undefined ? formatMoney(item.product.priceCad, 'CAD') : '—' }}</p>
      </div>
      <p v-if="options" class="mt-0.5 truncate text-[12px] text-thread-muted">{{ options }}</p>
      <div class="mt-auto flex items-center gap-1 pt-2.5">
        <a v-if="showLink" :href="checkoutUrl || productLink(item.product)" target="_blank" rel="noopener noreferrer" class="-ml-0.5 inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-thread-fill pr-2.5 text-[12px] font-medium transition hover:bg-thread-fill-strong" :class="checkoutUrl ? 'pl-1.5' : 'pl-3'">
          <ShopMark v-if="checkoutUrl" :size="18" />
          <span class="truncate">{{ checkoutUrl ? 'Continue to checkout' : `Buy at ${item.product.retailer}` }}</span>
          <ArrowUpRight class="h-3.5 w-3.5 shrink-0 text-thread-muted" :stroke-width="2" aria-hidden="true" />
        </a>
        <button type="button" class="ml-auto h-8 shrink-0 cursor-pointer rounded-full px-2.5 text-[12px] text-thread-muted transition hover:bg-thread-danger/10 hover:text-thread-danger" :aria-label="`Remove ${item.product.name} from Your Thread`" @click="emit('remove')">Remove</button>
      </div>
    </div>
  </article>
</template>
