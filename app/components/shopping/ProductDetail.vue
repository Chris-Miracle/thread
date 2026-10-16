<script setup lang="ts">
import { ArrowUpRight, Check, ShoppingBag, X } from 'lucide-vue-next'
import { hasRequiredShopOptions } from '~/domain/cart/checkoutPlan'
import { getProductVariantPolicy } from '~/domain/products/productVariants'
import type { Product, CartSelection } from '~/types/thread'
import { formatMoney } from '~/utils/money'
import { productLink, productProvenance } from '~/utils/productLinks'

const MAX_VARIANT_CHIPS = 24

const props = defineProps<{ product: Product; error?: string }>()
const emit = defineEmits<{ close: []; add: [options: CartSelection] }>()
const selectedSize = ref('')
const selectedColor = ref('')
const selectedVariantId = ref(props.product.commerce?.variantId ?? '')
const selectedVariant = computed(() => props.product.variants?.find(variant => variant.id === selectedVariantId.value))
const shopPrice = computed(() => selectedVariant.value?.currency === 'CAD' && selectedVariant.value.priceMinor !== undefined ? selectedVariant.value.priceMinor / 100 : selectedVariant.value?.priceCad)
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null
const displayPrice = computed(() => props.product.commerce ? (shopPrice.value !== undefined ? formatMoney(shopPrice.value, 'CAD') : 'Price not verified') : props.product.priceCad !== undefined
  ? formatMoney(props.product.priceCad, 'CAD')
  : props.product.nativePrice !== undefined && props.product.nativeCurrency
    ? formatMoney(props.product.nativePrice, props.product.nativeCurrency)
    : 'Price not verified')
const variantPolicy = computed(() => getProductVariantPolicy(props.product))
const variantReady = computed(() => props.product.stage === 'enriched'
  && (props.product.commerce ? Boolean(selectedVariant.value?.available && hasRequiredShopOptions(props.product, selectedVariant.value) && shopPrice.value !== undefined) : props.product.availability !== 'out-of-stock')
  && (props.product.commerce || (!variantPolicy.value.requiresSize || Boolean(selectedSize.value))
  && (!variantPolicy.value.requiresColor || Boolean(selectedColor.value))))
const variantOptions = computed(() => (props.product.variants ?? []).map(variant => ({
  value: variant.id,
  label: `${variant.options.map(option => option.label).join(' / ') || 'As listed'}${variant.available ? '' : ' · Sold out'}`,
  disabled: !variant.available,
})))
// What the listing offers before verification; the person's size and its stock are confirmed at enrichment.
const offeredGroups = computed(() => [
  { label: 'Colours offered', values: props.product.category === 'fragrance' ? [] : props.product.colors },
  { label: 'Sizes offered', values: props.product.category === 'fragrance' ? [] : props.product.sizes },
].filter(group => group.values.length))
const observedLabel = computed(() => new Date(props.product.observedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }))

watch(() => props.product.id, () => {
  selectedSize.value = ''
  selectedColor.value = ''
  selectedVariantId.value = props.product.commerce?.variantId ?? ''
})

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
  <Transition appear name="sheet">
    <div class="sheet-scrim fixed inset-0 z-50 flex items-end justify-center bg-thread-scrim backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" @click.self="emit('close')">
      <section ref="dialog" role="dialog" aria-modal="true" :aria-labelledby="`product-title-${product.id}`" class="sheet-panel thread-scrollbar relative max-h-[92dvh] w-full max-w-[980px] overflow-y-auto rounded-t-[28px] bg-thread-surface shadow-sheet sm:rounded-[28px] md:grid md:h-[min(86dvh,760px)] md:grid-cols-2 md:overflow-hidden">
        <span class="absolute left-1/2 top-2 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-thread-faint/50 sm:hidden" aria-hidden="true" />
        <button ref="closeButton" type="button" class="rove-icon-btn absolute right-4 top-4 z-10 bg-thread-surface/85 shadow-hairline backdrop-blur hover:bg-thread-surface md:bg-thread-fill md:shadow-none md:hover:bg-thread-fill-strong" aria-label="Close product details" @click="emit('close')">
          <X class="h-[18px] w-[18px]" :stroke-width="2" aria-hidden="true" />
        </button>

        <div class="relative bg-thread-well">
          <ProductImage
            :src="product.image"
            :alt="product.name"
            :width="product.imageWidth ?? 720"
            :height="product.imageHeight ?? 900"
            class="aspect-[4/5] max-h-[56dvh] w-full object-cover md:absolute md:inset-0 md:aspect-auto md:h-full md:max-h-none"
            fallback-class="flex aspect-[4/5] max-h-[56dvh] w-full items-center justify-center bg-thread-well text-thread-faint md:absolute md:inset-0 md:aspect-auto md:h-full md:max-h-none"
            :fallback-label="`Product preview unavailable for ${product.name}`"
          />
        </div>

        <div class="thread-scrollbar flex flex-col px-6 pb-8 pt-6 sm:px-9 sm:pb-9 md:overflow-y-auto md:pt-9">
          <div class="flex items-center gap-2 pr-12">
            <img :src="product.retailerLogo" alt="" width="20" height="20" class="h-5 w-5 shrink-0 rounded-[5px] bg-white object-contain shadow-hairline">
            <p class="min-w-0 truncate text-[13px]"><span class="font-medium">{{ product.retailer }}</span> <span class="text-thread-muted">· {{ productProvenance(product) }}</span></p>
          </div>

          <p v-if="product.brand" class="mt-7 text-[13px] text-thread-muted">{{ product.brand }}</p>
          <h2 :id="`product-title-${product.id}`" class="rove-headline text-balance text-[28px] leading-[1.12] sm:text-[32px]" :class="product.brand ? 'mt-1' : 'mt-7'">{{ product.name }}</h2>
          <p class="mt-3 text-[19px] tabular-nums tracking-[-0.01em]" :class="displayPrice === 'Price not verified' ? 'text-thread-muted' : ''">{{ displayPrice }}</p>
          <p v-if="product.description" class="mt-5 text-pretty text-[15px] leading-[1.55] text-thread-muted">{{ product.description }}</p>
          <p v-if="product.material" class="mt-3 text-[13px] leading-5 text-thread-muted"><span class="font-medium text-thread-ink">Material</span> &nbsp;{{ product.material }}</p>

          <div class="mt-8 space-y-6">
            <template v-if="product.stage === 'candidate'">
              <div v-for="group in offeredGroups" :key="group.label">
                <p class="text-[13px] font-medium">{{ group.label }}</p>
                <ul class="mt-2.5 flex flex-wrap gap-1.5" :aria-label="group.label">
                  <li v-for="value in group.values" :key="value" class="rounded-full bg-thread-fill px-3 py-1.5 text-[13px] tabular-nums">{{ value }}</li>
                </ul>
              </div>
              <p class="rounded-2xl bg-thread-canvas px-4 py-3.5 text-[13px] leading-[1.45] text-thread-muted">{{ offeredGroups.length ? 'Price and stock for each option are checked before this is added to your Thread.' : 'Price, sizes and stock haven’t been checked yet.' }}</p>
            </template>

            <template v-else-if="product.commerce">
              <OptionChips v-if="variantOptions.length <= MAX_VARIANT_CHIPS" v-model="selectedVariantId" label="Options" :options="variantOptions" />
              <label v-else class="block">
                <span class="text-[13px] font-medium">Options</span>
                <select v-model="selectedVariantId" class="rove-input mt-2.5 cursor-pointer">
                  <option value="" disabled>Select an option</option>
                  <option v-for="option in variantOptions" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
                </select>
              </label>
            </template>

            <template v-else>
              <OptionChips v-if="variantPolicy.requiresColor" v-model="selectedColor" label="Colour" :options="variantPolicy.colorOptions.map(value => ({ value, label: value }))" />
              <OptionChips v-if="variantPolicy.requiresSize" v-model="selectedSize" label="Size" :options="variantPolicy.sizeOptions.map(value => ({ value, label: value }))" />
              <p v-if="!variantPolicy.requiresColor && !variantPolicy.requiresSize" class="flex items-center gap-2 text-[13px] text-thread-muted">
                <Check class="h-4 w-4 text-thread-success" :stroke-width="2.2" aria-hidden="true" />
                {{ product.category === 'fragrance' ? 'Volume is set by this listing.' : 'Sold as listed — nothing to choose.' }}
              </p>
            </template>
          </div>

          <p v-if="error" role="alert" class="mt-6 rounded-xl bg-thread-danger/[0.07] px-4 py-3 text-[13px] text-thread-danger">{{ error }}</p>

          <div class="mt-8 grid gap-2.5 md:mt-auto md:pt-8">
            <button
              v-if="product.stage === 'enriched'"
              type="button"
              class="rove-btn-primary min-h-12 w-full"
              :disabled="!variantReady"
              @click="emit('add', product.commerce ? { variantId: selectedVariant?.id, selectedOptions: selectedVariant?.options } : { size: selectedSize || undefined, color: selectedColor || undefined })"
            >
              <ShoppingBag class="h-[18px] w-[18px]" :stroke-width="1.9" aria-hidden="true" /> Add to Your Thread
            </button>
            <a :href="productLink(product)" target="_blank" rel="noopener noreferrer" class="rove-btn-secondary min-h-12 w-full">
              View at {{ product.retailer }} <ArrowUpRight class="h-4 w-4" :stroke-width="2" aria-hidden="true" />
            </a>
          </div>
          <p class="mt-4 text-center text-[12px] text-thread-faint">Seen {{ observedLabel }} · Price and stock can change</p>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-enter-active { transition: opacity 220ms ease-out; }
.sheet-enter-active .sheet-panel { transition: transform 460ms cubic-bezier(0.32, 0.72, 0, 1), opacity 260ms ease-out; }
.sheet-enter-from { opacity: 0; }
.sheet-enter-from .sheet-panel { transform: translateY(40px); opacity: 0; }
@media (min-width: 640px) {
  .sheet-enter-from .sheet-panel { transform: translateY(12px) scale(0.98); }
}
</style>
