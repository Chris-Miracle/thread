<script setup lang="ts">
import { ShoppingBag } from 'lucide-vue-next'
import type { StyleProfile } from '~/types/thread'

defineProps<{ profile: StyleProfile; cartCount: number }>()
const emit = defineEmits<{ openCart: []; editProfile: []; reset: [] }>()
</script>

<template>
  <header class="rove-bar sticky top-0 z-30">
    <div class="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <a href="#main-content" class="rounded-lg" aria-label="Rove home"><RoveLogo compact /></a>
      <div class="relative flex items-center gap-1 sm:gap-1.5">
        <AccountMenu :profile="profile" @edit-profile="emit('editProfile')" @reset="emit('reset')" />
        <button
          type="button"
          class="flex h-9 cursor-pointer items-center gap-2 rounded-full px-2.5 text-thread-ink transition duration-200 hover:bg-thread-fill active:scale-[0.98] sm:px-3"
          :aria-label="`Open Your Thread with ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`"
          @click="emit('openCart')"
        >
          <ShoppingBag class="h-[18px] w-[18px]" :stroke-width="1.8" aria-hidden="true" />
          <span class="hidden text-[13px] font-medium sm:inline">Your Thread</span>
          <Transition name="badge" mode="out-in">
            <span v-if="cartCount" :key="cartCount" class="grid h-5 min-w-5 place-items-center rounded-full bg-thread-ink px-1.5 text-[11px] font-semibold tabular-nums text-thread-on-ink">{{ cartCount }}</span>
          </Transition>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.badge-enter-active { transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 160ms ease-out; }
.badge-leave-active { transition: transform 120ms ease-in, opacity 120ms ease-in; }
.badge-enter-from { transform: scale(0.4); opacity: 0; }
.badge-leave-to { transform: scale(0.6); opacity: 0; }
</style>
