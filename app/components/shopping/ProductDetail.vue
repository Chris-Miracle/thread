<script setup lang="ts">
import { ExternalLink, ShoppingBag, X } from 'lucide-vue-next'
import type { Product } from '~/types/thread'
import { formatMoney } from '~/utils/money'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ close: []; add: [options: { size?: string; color?: string }] }>()
const selectedSize = ref('')
const selectedColor = ref('')
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
const displayPrice = computed(() => props.product.priceCad !== undefined
  ? formatMoney(props.product.priceCad, 'CAD')
  : props.product.nativePrice !== undefined && props.product.nativeCurrency
    ? formatMoney(props.product.nativePrice, props.product.nativeCurrency)
    : 'Price not verified')
const variantReady = computed(() => props.product.stage === 'enriched'
  && (!props.product.sizes.length || Boolean(selectedSize.value))
  && (!props.product.colors.length || Boolean(selectedColor.value)))

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  previouslyFocused?.focus()
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" role="presentation" @click.self="emit('close')">
    <section ref="dialog" role="dialog" aria-modal="true" :aria-labelledby="`product-title-${product.id}`" class="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto bg-thread-surface shadow-soft sm:max-h-[88dvh]">
      <button ref="closeButton" type="button" class="absolute right-3 top-3 z-10 flex h-11 w-11 cursor-pointer items-center justify-center bg-thread-surface text-thread-ink transition hover:bg-thread-ink hover:text-white" aria-label="Close product details" @click="emit('close')">
        <X class="h-5 w-5" aria-hidden="true" />
      </button>
      <div class="grid md:grid-cols-2">
        <div class="min-h-72 bg-thread-soft">
          <ProductImage
            :src="product.image"
            :alt="product.name"
            :width="product.imageWidth ?? 720"
            :height="product.imageHeight ?? 900"
            class="h-auto max-h-[78dvh] w-full object-contain"
            fallback-class="flex min-h-72 w-full items-center justify-center bg-thread-soft text-thread-muted md:min-h-full"
            :fallback-label="`Product preview unavailable for ${product.name}`"
          />
        </div>
        <div class="p-6 pt-16 sm:p-9 sm:pt-16">
          <div class="flex items-center gap-2.5">
            <img :src="product.retailerLogo" alt="" width="28" height="28" class="h-7 w-7 rounded border border-thread-line bg-white object-contain p-0.5">
            <div>
              <p class="text-xs font-medium">{{ product.retailer }}</p>
              <p class="text-[10px] text-thread-muted">{{ product.source === 'agent' ? 'Agent sourced from canonical retailer page' : 'Development fixture' }}</p>
            </div>
          </div>
          <p class="mt-7 text-[11px] font-medium uppercase tracking-[0.15em] text-thread-muted">{{ product.brand || product.category || 'Product candidate' }}</p>
          <h2 :id="`product-title-${product.id}`" class="mt-2 font-editorial text-4xl leading-tight sm:text-5xl">{{ product.name }}</h2>
          <p class="mt-4 text-lg tabular-nums">{{ displayPrice }}</p>
          <p v-if="product.description" class="mt-5 text-sm leading-6 text-thread-muted">{{ product.description }}</p>
          <p v-if="product.material" class="mt-3 text-xs leading-5 text-thread-muted"><span class="font-medium text-thread-ink">Material:</span> {{ product.material }}</p>

          <div v-if="product.stage === 'candidate'" class="mt-7 border border-thread-line bg-thread-canvas p-4">
            <p class="text-sm font-medium">Candidate details are not enriched yet.</p>
            <p class="mt-2 text-xs leading-5 text-thread-muted">Ask your browser agent to inspect this product with <code>enrich_product</code>, or continue on the retailer page to verify price, stock, sizes, and colours.</p>
          </div>

          <template v-else>
            <label v-if="product.colors.length" class="mt-7 block text-xs font-medium text-thread-muted">Colour
              <select v-model="selectedColor" class="mt-2 min-h-11 w-full border border-thread-line bg-white px-3 text-sm text-thread-ink">
                <option value="" disabled>Select a colour</option>
                <option v-for="color in product.colors" :key="color" :value="color">{{ color }}</option>
              </select>
            </label>
            <label v-if="product.sizes.length" class="mt-5 block text-xs font-medium text-thread-muted">Size
              <select v-model="selectedSize" class="mt-2 min-h-11 w-full border border-thread-line bg-white px-3 text-sm text-thread-ink">
                <option value="" disabled>Select a size</option>
                <option v-for="size in product.sizes" :key="size" :value="size">{{ size }}</option>
              </select>
            </label>
          </template>

          <div class="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              v-if="product.stage === 'enriched'"
              type="button"
              class="flex min-h-12 cursor-pointer items-center justify-center gap-2 bg-thread-ink px-4 text-sm font-medium text-white transition hover:bg-thread-accent disabled:cursor-not-allowed disabled:opacity-45"
              :disabled="!variantReady"
              @click="emit('add', { size: selectedSize || undefined, color: selectedColor || undefined })"
            >
              <ShoppingBag class="h-4 w-4" aria-hidden="true" /> Add to your Thread
            </button>
            <a :href="product.url" target="_blank" rel="noopener noreferrer" class="flex min-h-12 items-center justify-center gap-2 border border-thread-line px-4 text-sm font-medium transition hover:border-thread-ink">
              Open retailer <ExternalLink class="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <p class="mt-5 text-[11px] leading-5 text-thread-muted">Observed {{ new Date(product.observedAt).toLocaleString('en-CA') }}. THREAD does not perform retailer checkout or guarantee current stock.</p>
        </div>
      </div>
    </section>
  </div>
</template>
