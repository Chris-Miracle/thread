<script setup lang="ts">
import { ChevronRight, RotateCcw, UserRound } from 'lucide-vue-next'
import type { StyleProfile } from '~/types/thread'

const props = defineProps<{ profile: StyleProfile }>()
const emit = defineEmits<{ editProfile: []; reset: [] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelId = useId()
const initial = computed(() => props.profile.name.trim().charAt(0).toUpperCase() || 'R')
const styleSummary = computed(() => [props.profile.shoppingDepartment === 'all' ? 'Everyone' : props.profile.shoppingDepartment, ...props.profile.styles.map(style => style.replace('-', ' '))].join(' · '))

function close({ restoreFocus = false } = {}) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}

function choose(action: 'editProfile' | 'reset') {
  close()
  if (action === 'editProfile') emit('editProfile')
  else emit('reset')
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  close({ restoreFocus: true })
}

/** Tabbing past the last control dismisses the popover, as a menu would. */
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && !root.value?.contains(next)) close()
}

function stopListening() {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
}

watch(open, async (isOpen) => {
  stopListening()
  if (!isOpen) return
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeydown)
  await nextTick()
  panel.value?.querySelector<HTMLElement>('button')?.focus()
})

onUnmounted(stopListening)
</script>

<template>
  <!-- Not positioned itself: the popover anchors to the header's control group so it keeps the page gutter on phones. -->
  <div ref="root" @focusout="onFocusOut">
    <button
      ref="trigger"
      type="button"
      class="flex h-9 cursor-pointer items-center gap-2 rounded-full pl-1 pr-1 transition duration-200 hover:bg-thread-fill active:scale-[0.98] sm:pr-3"
      :class="open ? 'bg-thread-fill' : ''"
      aria-label="Account and appearance"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <span class="grid h-7 w-7 place-items-center rounded-full bg-thread-ink text-[12px] font-semibold text-thread-on-ink" aria-hidden="true">{{ initial }}</span>
      <span class="hidden max-w-32 truncate text-[13px] font-medium text-thread-ink sm:inline">{{ profile.name }}</span>
    </button>

    <Transition name="popover">
      <div
        v-if="open"
        :id="panelId"
        ref="panel"
        role="dialog"
        aria-label="Account and appearance"
        class="absolute right-0 top-[calc(100%+10px)] z-40 w-[288px] origin-top-right rounded-[20px] bg-thread-surface p-2 shadow-sheet"
      >
        <div class="flex items-center gap-3 px-2.5 pb-3 pt-2">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-thread-ink text-[15px] font-semibold text-thread-on-ink" aria-hidden="true">{{ initial }}</span>
          <div class="min-w-0">
            <p class="truncate text-[15px] font-semibold tracking-[-0.01em]">{{ profile.name }}</p>
            <p class="truncate text-[12px] capitalize text-thread-muted">{{ styleSummary }}</p>
          </div>
        </div>

        <button type="button" class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[14px] transition hover:bg-thread-fill" @click="choose('editProfile')">
          <UserRound class="h-[18px] w-[18px] text-thread-muted" :stroke-width="1.8" aria-hidden="true" />
          <span class="flex-1">Style profile</span>
          <ChevronRight class="h-4 w-4 text-thread-faint" :stroke-width="2" aria-hidden="true" />
        </button>

        <div class="mx-2.5 my-1.5 h-px bg-thread-line" />

        <div class="px-2.5 pb-2 pt-2">
          <p class="text-[12px] font-medium text-thread-muted">Appearance</p>
          <AppearancePicker class="mt-3" />
        </div>

        <div class="mx-2.5 my-1.5 h-px bg-thread-line" />

        <button type="button" class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[14px] text-thread-danger transition hover:bg-thread-danger/10" @click="choose('reset')">
          <RotateCcw class="h-[18px] w-[18px]" :stroke-width="1.8" aria-hidden="true" />
          Reset Rove…
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.popover-enter-active { transition: opacity 160ms ease-out, transform 280ms cubic-bezier(0.32, 0.72, 0, 1); }
.popover-leave-active { transition: opacity 120ms ease-in, transform 120ms ease-in; }
.popover-enter-from, .popover-leave-to { opacity: 0; transform: scale(0.95) translateY(-4px); }
</style>
