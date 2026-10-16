<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const cancelButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  cancelButton.value?.focus()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition appear name="alert">
    <div class="fixed inset-0 z-[90] grid place-items-center bg-thread-scrim p-5 backdrop-blur-[2px]" role="presentation" @click.self="emit('cancel')">
      <section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" class="alert-panel w-full max-w-[340px] rounded-[22px] bg-thread-surface p-6 text-center shadow-sheet">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-thread-danger/10 text-thread-danger" aria-hidden="true">
          <RotateCcw class="h-5 w-5" :stroke-width="2" />
        </span>
        <h2 id="reset-title" class="mt-4 text-[17px] font-semibold tracking-[-0.01em]">Reset Rove?</h2>
        <p id="reset-description" class="mt-1.5 text-[13px] leading-[1.45] text-thread-muted">Your profile, research, saved edits and Thread will be cleared from this browser. This can’t be undone.</p>
        <div class="mt-6 grid gap-2">
          <button type="button" class="rove-btn bg-thread-danger/10 text-thread-danger hover:bg-thread-danger/15" @click="emit('confirm')">Clear local data</button>
          <button ref="cancelButton" type="button" class="rove-btn-secondary" @click="emit('cancel')">Cancel</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.alert-enter-active { transition: opacity 200ms ease-out; }
.alert-enter-active .alert-panel { transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1); }
.alert-enter-from { opacity: 0; }
.alert-enter-from .alert-panel { transform: scale(1.06); }
</style>
