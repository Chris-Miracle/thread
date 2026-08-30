<script setup lang="ts">
import { ExternalLink, ShoppingBag, X } from 'lucide-vue-next'
import type { Product } from '~/types/thread'
import { formatMoney } from '~/utils/money'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ close: []; add: [options: { size?: string; color?: string }] }>()
const selectedSize = ref(props.product.sizes[0] ?? '')
const selectedColor = ref(props.product.colors[0] ?? '')
const closeButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" role="presentation" @click.self="emit('close')">
    <section role="dialog" aria-modal="true" :aria-labelledby="`product-title-${product.id}`" class="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto bg-thread-surface shadow-soft sm:max-h-[88dvh]">
      <button ref="closeButton" type="button" class="absolute right-3 top-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center bg-thread-surface text-thread-ink transition hover:bg-thread-ink hover:text-white" aria-label="Close product details" @click="emit('close')">
        <X class="h-5 w-5" aria-hidden="true" />
      </button>
      <div class="grid md:grid-cols-2">
        <div class="aspect-[4/5] min-h-0 bg-thread-soft md:aspect-auto">
          <img :src="product.image" :alt="`${product.name} by ${product.brand}`" width="900" height="1125" class="h-full w-full object-cover">
        </div>
        <div class="flex flex-col p-6 sm:p-9 lg:p-12">
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-thread-muted">{{ product.retailer }} / {{ product.brand }}</p>
          <h2 :id="`product-title-${product.id}`" class="mt-4 font-editorial text-4xl leading-none sm:text-5xl">{{ product.name }}</h2>
          <p class="mt-4 text-lg tabular-nums">{{ formatMoney(product.price, product.currency) }}</p>
          <p class="mt-6 text-sm leading-7 text-thread-muted">{{ product.description }}</p>
          <a :href="product.url" target="_blank" rel="noopener noreferrer" class="mt-4 flex min-h-11 items-center gap-2 self-start text-sm font-medium underline decoration-thread-line underline-offset-4 transition hover:text-thread-accent">
            View live product at {{ product.retailer }} <ExternalLink class="h-4 w-4" aria-hidden="true" />
          </a>

          <div class="mt-8 space-y-6 border-y border-thread-line py-6">
            <fieldset>
              <legend class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-thread-muted">Colour</legend>
              <div class="flex flex-wrap gap-2">
                <button v-for="color in product.colors" :key="color" type="button" class="min-h-11 cursor-pointer border px-4 text-sm transition" :class="selectedColor === color ? 'border-thread-ink bg-thread-ink text-white' : 'border-thread-line hover:border-thread-ink'" :aria-pressed="selectedColor === color" @click="selectedColor = color">{{ color }}</button>
              </div>
            </fieldset>
            <fieldset>
              <legend class="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-thread-muted">Size</legend>
              <div class="flex flex-wrap gap-2">
                <button v-for="size in product.sizes" :key="size" type="button" class="min-h-11 min-w-11 cursor-pointer border px-3 text-sm transition" :class="selectedSize === size ? 'border-thread-ink bg-thread-ink text-white' : 'border-thread-line hover:border-thread-ink'" :aria-pressed="selectedSize === size" @click="selectedSize = size">{{ size }}</button>
              </div>
            </fieldset>
          </div>

          <div class="mt-auto pt-8">
            <div class="mb-5 flex flex-wrap gap-2">
              <span v-for="tag in product.styleTags" :key="tag" class="border border-thread-line px-2.5 py-1 text-[11px] capitalize text-thread-muted">{{ tag.replace('-', ' ') }}</span>
            </div>
            <button type="button" class="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 bg-thread-ink px-6 text-sm font-medium text-white transition hover:bg-thread-accent" @click="emit('add', { size: selectedSize || undefined, color: selectedColor || undefined })">
              <ShoppingBag class="h-4 w-4" :stroke-width="1.8" aria-hidden="true" />
              Add to Thread
            </button>
            <p class="mt-3 text-center text-[11px] leading-5 text-thread-muted">Price and availability observed {{ new Date(product.observedAt).toLocaleDateString('en-CA') }}. Confirm on the retailer page before purchase.</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
