<script setup lang="ts">
import { ArrowUpRight, ShoppingBag, X } from 'lucide-vue-next'
import type { CheckoutGroup, CartSummary } from '~/types/thread'
import { formatMoney } from '~/utils/money'

const props = defineProps<{ cart: CartSummary }>()
const emit = defineEmits<{ close: []; remove: [itemId: string]; clear: [] }>()
const confirmClear = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const itemsById = computed(() => new Map(props.cart.items.map(item => [item.id, item])))
const groupedItems = computed(() => props.cart.groups.map(group => ({
  group,
  items: group.lines.map(line => itemsById.value.get(line.itemId)).filter(item => item !== undefined),
})))
const storeCount = computed(() => props.cart.groups.length)

function merchantTotal(group: CheckoutGroup): string | null {
  const cart = group.merchantCart
  if (cart?.totalMinor === undefined || !cart.currency) return null
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: cart.currency }).resolvedOptions().maximumFractionDigits ?? 2
  return formatMoney(cart.totalMinor / 10 ** digits, cart.currency)
}

function hasMerchantCheckout(group: CheckoutGroup): boolean {
  return group.status === 'ready' && Boolean(group.merchantCart)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
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

function clearConfirmed() {
  emit('clear')
  confirmClear.value = false
}
</script>

<template>
  <Transition appear name="drawer">
    <div class="drawer-scrim fixed inset-0 z-50 bg-thread-scrim backdrop-blur-[2px]" role="presentation" @click.self="emit('close')">
      <aside ref="dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title" class="drawer-panel absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-thread-surface shadow-sheet sm:inset-y-2 sm:right-2 sm:rounded-[24px]">
        <header class="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div>
            <h2 id="cart-title" class="rove-headline text-[26px] leading-tight">Your Thread</h2>
            <p class="mt-0.5 text-[13px] text-thread-muted">
              <template v-if="cart.itemCount">{{ cart.itemCount }} {{ cart.itemCount === 1 ? 'piece' : 'pieces' }} · {{ storeCount }} {{ storeCount === 1 ? 'store' : 'stores' }}</template>
              <template v-else>Nothing saved yet</template>
            </p>
          </div>
          <button ref="closeButton" type="button" class="rove-icon-btn -mr-1.5 bg-thread-fill" aria-label="Close Your Thread" @click="emit('close')">
            <X class="h-[18px] w-[18px]" :stroke-width="2" aria-hidden="true" />
          </button>
        </header>

        <div v-if="cart.items.length" class="thread-scrollbar flex-1 overflow-y-auto px-6">
          <section v-for="{ group, items } in groupedItems" :key="group.key" class="border-t border-thread-line py-5 first:border-t-0 first:pt-1" :data-status="group.status">
            <div class="flex items-center gap-3">
              <img v-if="items[0]?.product.retailerLogo" :src="items[0].product.retailerLogo" alt="" width="32" height="32" class="h-8 w-8 shrink-0 rounded-[9px] bg-white object-contain p-1 shadow-hairline">
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-[15px] font-semibold">{{ group.sellerName }}</h3>
                <p class="text-[12px] text-thread-muted">{{ items.length }} {{ items.length === 1 ? 'piece' : 'pieces' }}<template v-if="group.estimatedSubtotalCad"> · {{ formatMoney(group.estimatedSubtotalCad, 'CAD') }}</template></p>
              </div>
            </div>

            <CartItem v-for="item in items" :key="item.id" :item="item" :show-link="!hasMerchantCheckout(group)" @remove="emit('remove', item.id)" />

            <a v-if="hasMerchantCheckout(group) && group.merchantCart" :href="group.merchantCart.continueUrl" target="_blank" rel="noopener noreferrer" class="rove-btn-primary mt-1 w-full">
              <ShopMark :size="18" />
              Continue to checkout
              <span v-if="merchantTotal(group)" class="font-normal text-thread-on-ink/60">· {{ merchantTotal(group) }}</span>
              <ArrowUpRight class="h-4 w-4 text-thread-on-ink/60" :stroke-width="2" aria-hidden="true" />
            </a>
            <p v-else-if="group.status === 'ordered'" class="mt-1 flex items-center gap-2 text-[13px] font-medium text-thread-success">
              Ordered
              <a v-if="group.merchantCart?.orderPermalink" :href="group.merchantCart.orderPermalink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-thread-ink hover:underline">View order <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" /></a>
            </p>
            <p v-else-if="group.status === 'stale'" class="mt-1 text-[12px] text-thread-muted">Items changed since this checkout was prepared.</p>
            <ul v-if="group.merchantCart?.messages.length && group.status !== 'ordered'" class="mt-3 space-y-1 text-[12px] leading-[1.45] text-thread-muted">
              <li v-for="message in group.merchantCart.messages" :key="message">{{ message }}</li>
            </ul>
          </section>
        </div>
        <div v-else class="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
          <span class="grid h-14 w-14 place-items-center rounded-full bg-thread-canvas" aria-hidden="true">
            <ShoppingBag class="h-6 w-6 text-thread-muted" :stroke-width="1.6" />
          </span>
          <p class="mt-5 text-[19px] font-semibold tracking-[-0.01em]">Your Thread is empty</p>
          <p class="mt-1.5 max-w-[260px] text-[14px] leading-[1.45] text-thread-muted">Pieces you save from any store will collect here.</p>
        </div>

        <footer v-if="cart.items.length" class="shrink-0 border-t border-thread-line px-6 pb-6 pt-5">
          <div v-for="total in cart.totals" :key="total.currency" class="flex items-baseline justify-between gap-4">
            <span class="text-[15px]">Estimated subtotal</span>
            <span class="text-[19px] font-semibold tabular-nums tracking-[-0.01em]">{{ formatMoney(total.subtotal, total.currency) }}</span>
          </div>
          <p v-if="cart.unpricedItemCount" class="mt-1 text-[12px] text-thread-muted">{{ cart.unpricedItemCount }} {{ cart.unpricedItemCount === 1 ? 'piece has' : 'pieces have' }} no verified price yet.</p>
          <div class="mt-4 flex min-h-9 items-center justify-center">
            <button v-if="!confirmClear" type="button" class="cursor-pointer rounded-full px-3 py-1.5 text-[13px] text-thread-muted transition hover:bg-thread-fill hover:text-thread-ink" @click="confirmClear = true">Clear Your Thread</button>
            <div v-else class="flex items-center gap-1 text-[13px]">
              <span class="mr-2 text-thread-muted">Remove every piece?</span>
              <button type="button" class="cursor-pointer rounded-full px-3 py-1.5 font-medium text-thread-danger transition hover:bg-thread-danger/10" @click="clearConfirmed">Clear all</button>
              <button type="button" class="cursor-pointer rounded-full px-3 py-1.5 text-thread-muted transition hover:bg-thread-fill" @click="confirmClear = false">Cancel</button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active { transition: opacity 220ms ease-out; }
.drawer-enter-active .drawer-panel { transition: transform 420ms cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-enter-from { opacity: 0; }
.drawer-enter-from .drawer-panel { transform: translateX(104%); }
</style>
