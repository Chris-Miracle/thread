<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'
import type { ThreadToastMessage } from '~/types/thread'

defineProps<{ toast: ThreadToastMessage | null }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4" aria-live="polite" aria-atomic="true">
    <Transition name="toast">
      <div v-if="toast" :key="toast.id" class="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-thread-hud/90 py-2 pl-2.5 pr-2 text-[14px] text-white shadow-sheet backdrop-blur-xl">
        <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden="true">
          <Check class="h-3.5 w-3.5" :stroke-width="2.4" />
        </span>
        <span class="leading-5">{{ toast.message }}</span>
        <button type="button" class="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white" aria-label="Dismiss notification" @click="emit('dismiss')">
          <X class="h-3.5 w-3.5" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active { transition: opacity 240ms ease-out, transform 360ms cubic-bezier(0.32, 0.72, 0, 1); }
.toast-leave-active { transition: opacity 160ms ease-in, transform 160ms ease-in; }
.toast-enter-from { opacity: 0; transform: translateY(12px) scale(0.96); }
.toast-leave-to { opacity: 0; transform: translateY(6px); }
</style>
