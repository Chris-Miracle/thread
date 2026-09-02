<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'
import type { ThreadToastMessage } from '~/types/thread'

defineProps<{ toast: ThreadToastMessage | null }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-5" aria-live="polite" aria-atomic="true">
    <Transition name="toast">
      <div v-if="toast" :key="toast.id" class="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-thread-ink px-4 py-3 text-sm text-white shadow-soft">
        <Check class="h-4 w-4 shrink-0" :stroke-width="1.8" aria-hidden="true" />
        <span class="leading-5">{{ toast.message }}</span>
        <button type="button" class="ml-2 flex h-8 w-8 cursor-pointer items-center justify-center text-white/70 transition hover:text-white" aria-label="Dismiss notification" @click="emit('dismiss')">
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
