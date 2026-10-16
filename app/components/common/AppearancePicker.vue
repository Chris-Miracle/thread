<script setup lang="ts">
import type { AppearancePreference } from '~/utils/appearance'

const { preference, setPreference } = useAppearance()
const options: Array<{ value: AppearancePreference; label: string; accessibleLabel: string }> = [
  { value: 'system', label: 'Auto', accessibleLabel: 'Auto, matches your system setting' },
  { value: 'light', label: 'Light', accessibleLabel: 'Light' },
  { value: 'dark', label: 'Dark', accessibleLabel: 'Dark' },
]
const buttons = ref<HTMLButtonElement[]>([])

function select(index: number) {
  const option = options[(index + options.length) % options.length]
  if (!option) return
  setPreference(option.value)
  nextTick(() => buttons.value[options.indexOf(option)]?.focus())
}

function onKeydown(event: KeyboardEvent) {
  const current = options.findIndex(option => option.value === preference.value)
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') select(current + 1)
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') select(current - 1)
  else return
  event.preventDefault()
}
</script>

<template>
  <div role="radiogroup" aria-label="Appearance" class="grid grid-cols-3 gap-2.5" @keydown="onKeydown">
    <button
      v-for="option in options"
      :key="option.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="preference === option.value"
      :aria-label="option.accessibleLabel"
      :tabindex="preference === option.value ? 0 : -1"
      class="group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl focus:outline-none"
      @click="setPreference(option.value)"
    >
      <span
        class="relative block aspect-[4/3] w-full overflow-hidden rounded-[9px] ring-offset-2 ring-offset-thread-surface transition duration-200 group-focus-visible:ring-2 group-focus-visible:ring-thread-accent"
        :class="preference === option.value ? 'ring-2 ring-thread-ink' : 'shadow-hairline group-hover:shadow-hairline-strong'"
        aria-hidden="true"
      >
        <span v-if="option.value !== 'dark'" class="preview preview-light"><span class="preview-bar" /><span class="preview-mark" /><span class="preview-card"><span class="preview-title" /><span class="preview-line" /></span></span>
        <span v-if="option.value !== 'light'" class="preview preview-dark" :class="option.value === 'system' ? 'preview-split' : ''"><span class="preview-bar" /><span class="preview-mark" /><span class="preview-card"><span class="preview-title" /><span class="preview-line" /></span></span>
      </span>
      <span class="text-[12px] transition" :class="preference === option.value ? 'font-semibold text-thread-ink' : 'text-thread-muted group-hover:text-thread-ink'">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Fixed colours on purpose: each tile depicts its theme, whatever the current one is. */
.preview { position: absolute; inset: 0; background: var(--canvas); }
.preview-light { --canvas: #f2eee7; --bar: rgb(28 26 23 / 0.07); --card: #fffdfa; --ink: #1c1a17; --line: #e0dad0; }
.preview-dark { --canvas: #0d1016; --bar: rgb(200 215 235 / 0.09); --card: #1e232c; --ink: #f1f3f6; --line: #333a46; }
.preview-split { clip-path: polygon(62% 0, 100% 0, 100% 100%, 38% 100%); }
.preview-bar { position: absolute; inset: 0 0 auto; height: 18%; background: var(--bar); }
.preview-mark { position: absolute; left: 9%; top: 5%; width: 9%; height: 8%; border-radius: 2px; background: var(--ink); }
.preview-mark::after { content: ''; position: absolute; right: -60%; top: 10%; width: 45%; aspect-ratio: 1; border-radius: 50%; background: #f05218; }
.preview-card { position: absolute; left: 9%; right: 9%; top: 30%; bottom: 12%; border-radius: 4px; background: var(--card); box-shadow: 0 0 0 0.5px var(--bar); }
.preview-title { position: absolute; left: 10%; top: 22%; width: 58%; height: 14%; border-radius: 99px; background: var(--ink); }
.preview-line { position: absolute; left: 10%; top: 52%; width: 40%; height: 11%; border-radius: 99px; background: var(--line); }
</style>
