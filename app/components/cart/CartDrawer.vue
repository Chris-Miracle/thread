<script setup lang="ts">
import { ShoppingBag, X } from 'lucide-vue-next'
import type { CartSummary } from '~/types/thread'
import { formatMoney } from '~/utils/money'

const props = defineProps<{ cart: CartSummary }>()
const emit = defineEmits<{ close: []; remove: [itemId: string]; clear: [] }>()
const confirmClear = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)

const groupedItems = computed(() => {
  const groups = new Map<string, typeof props.cart.items>()
  for (const item of props.cart.items) {
    const group = groups.get(item.product.retailer) ?? []
    group.push(item)
    groups.set(item.product.retailer, group)
  }
  return [...groups.entries()]
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function clearConfirmed() {
  emit('clear')
  confirmClear.value = false
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/50" role="presentation" @click.self="emit('close')">
    <Transition appear name="drawer">
      <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-thread-surface shadow-soft">
        <header class="flex h-[72px] shrink-0 items-center justify-between border-b border-thread-line px-5 sm:px-6">
          <div>
            <h2 id="cart-title" class="font-editorial text-3xl">Your Thread</h2>
            <p class="text-xs text-thread-muted">{{ cart.itemCount }} {{ cart.itemCount === 1 ? 'piece' : 'pieces' }} across stores</p>
          </div>
          <button ref="closeButton" type="button" class="flex h-11 w-11 cursor-pointer items-center justify-center transition hover:bg-thread-soft" aria-label="Close cart" @click="emit('close')">
            <X class="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div v-if="cart.items.length" class="thread-scrollbar flex-1 overflow-y-auto px-5 py-2 sm:px-6">
          <section v-for="[retailer, items] in groupedItems" :key="retailer" class="mt-6">
            <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-thread-muted">{{ retailer }}</h3>
            <CartItem v-for="item in items" :key="item.id" :item="item" @remove="emit('remove', item.id)" />
          </section>
        </div>
        <div v-else class="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <ShoppingBag class="h-8 w-8 text-thread-muted" :stroke-width="1.4" aria-hidden="true" />
          <p class="mt-5 font-editorial text-3xl">Your Thread is open.</p>
          <p class="mt-2 max-w-xs text-sm leading-6 text-thread-muted">Save pieces from any store and they will collect here.</p>
        </div>

        <footer class="shrink-0 border-t border-thread-line bg-thread-canvas px-5 py-5 sm:px-6">
          <div v-for="total in cart.totals" :key="total.currency" class="mb-3 flex items-center justify-between">
            <span class="text-sm text-thread-muted">Subtotal {{ total.currency }}</span>
            <span class="text-lg font-medium tabular-nums">{{ formatMoney(total.subtotal, total.currency) }}</span>
          </div>
          <p class="border border-thread-line bg-thread-surface px-4 py-3 text-center text-[11px] leading-5 text-thread-muted">Use each “Buy at retailer” link above. Thread never pretends to complete a retailer checkout.</p>
          <div v-if="cart.items.length" class="mt-4 flex min-h-11 items-center justify-center">
            <button v-if="!confirmClear" type="button" class="cursor-pointer text-xs text-thread-muted underline decoration-thread-line underline-offset-4 transition hover:text-thread-danger" @click="confirmClear = true">Clear cart</button>
            <div v-else class="flex items-center gap-4 text-xs">
              <span class="text-thread-muted">Clear every item?</span>
              <button type="button" class="min-h-11 cursor-pointer font-medium text-thread-danger" @click="clearConfirmed">Clear all</button>
              <button type="button" class="min-h-11 cursor-pointer text-thread-muted" @click="confirmClear = false">Cancel</button>
            </div>
          </div>
        </footer>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.drawer-enter-active { transition: transform 260ms ease-out; }
.drawer-enter-from { transform: translateX(100%); }
</style>
