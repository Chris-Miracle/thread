<script setup lang="ts">
import { RotateCcw, ShoppingBag, UserRound } from 'lucide-vue-next'
import type { StyleProfile } from '~/types/thread'

defineProps<{ profile: StyleProfile; cartCount: number }>()
const emit = defineEmits<{ openCart: []; editProfile: []; reset: [] }>()
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-thread-line/90 bg-thread-canvas/95 backdrop-blur-sm">
    <div class="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 sm:h-[72px] sm:px-8 lg:px-12">
      <a href="#main-content" class="text-sm font-semibold tracking-[0.28em]" aria-label="Thread home">THREAD</a>
      <div class="flex items-center gap-1.5 sm:gap-3">
        <button type="button" class="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs text-thread-muted transition hover:text-thread-danger sm:px-3" aria-label="Reset browser data" @click="emit('reset')"><RotateCcw class="h-4 w-4" aria-hidden="true" /><span class="hidden lg:inline">Reset</span></button>
        <button
          type="button"
          class="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm text-thread-muted transition hover:text-thread-ink sm:border sm:border-thread-line sm:bg-thread-surface sm:px-4"
          aria-label="Edit style profile"
          @click="emit('editProfile')"
        >
          <UserRound class="h-4 w-4" :stroke-width="1.7" aria-hidden="true" />
          <span class="hidden sm:inline">{{ profile.name }}</span>
          <span class="hidden text-thread-line sm:inline">/</span>
          <span class="hidden max-w-64 truncate text-xs capitalize sm:inline">{{ profile.gender }}<template v-if="profile.styles.length"> · {{ profile.styles.map(style => style.replace('-', ' ')).join(' · ') }}</template></span>
        </button>
        <button
          type="button"
          class="relative flex min-h-11 cursor-pointer items-center gap-2 border border-thread-ink bg-thread-ink px-3.5 text-sm font-medium text-white transition hover:bg-thread-accent sm:px-5"
          :aria-label="`Open cart with ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`"
          @click="emit('openCart')"
        >
          <ShoppingBag class="h-4 w-4" :stroke-width="1.8" aria-hidden="true" />
          <span class="hidden sm:inline">Your Thread</span>
          <span class="min-w-4 text-center text-xs tabular-nums">{{ cartCount }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
