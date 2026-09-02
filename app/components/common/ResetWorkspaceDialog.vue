<script setup lang="ts">
import { RotateCcw, X } from 'lucide-vue-next'
const emit = defineEmits<{ cancel: []; confirm: [] }>()
</script>

<template>
  <div class="fixed inset-0 z-[90] grid place-items-center bg-thread-ink/55 p-5" role="presentation" @click.self="emit('cancel')">
    <section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" class="rove-glass-strong w-full max-w-md rounded-[1.75rem] border p-6 shadow-glass sm:p-8">
      <div class="flex items-start justify-between gap-4"><RotateCcw class="mt-1 h-5 w-5 text-thread-danger" aria-hidden="true" /><button type="button" class="grid min-h-11 min-w-11 cursor-pointer place-items-center text-thread-muted hover:text-thread-ink" aria-label="Cancel reset" @click="emit('cancel')"><X class="h-5 w-5" aria-hidden="true" /></button></div>
      <h2 id="reset-title" class="mt-5 font-editorial text-4xl">Reset Rove?</h2>
      <p id="reset-description" class="mt-3 text-sm leading-6 text-thread-muted">This clears your profile, products found by agents, search state, and cart from this browser. It cannot be undone.</p>
      <div class="mt-7 grid gap-3 sm:grid-cols-2"><button type="button" class="min-h-11 cursor-pointer rounded-full border border-thread-line px-4 text-sm hover:bg-thread-soft" @click="emit('cancel')">Keep my workspace</button><button type="button" class="min-h-11 cursor-pointer rounded-full bg-thread-danger px-4 text-sm font-medium text-white hover:opacity-90" @click="emit('confirm')">Clear local data</button></div>
    </section>
  </div>
</template>
