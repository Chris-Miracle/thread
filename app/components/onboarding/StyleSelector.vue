<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { MAX_PROFILE_STYLES, MIN_PROFILE_STYLES, STYLE_OPTIONS, type StyleId } from '~/types/thread'

const props = defineProps<{ modelValue: StyleId[] }>()
const emit = defineEmits<{ 'update:modelValue': [styles: StyleId[]] }>()

function toggle(style: StyleId) {
  const selected = props.modelValue.includes(style)
  if (selected) emit('update:modelValue', props.modelValue.filter(item => item !== style))
  else if (props.modelValue.length < MAX_PROFILE_STYLES) emit('update:modelValue', [...props.modelValue, style])
}
</script>

<template>
  <fieldset>
    <div class="flex items-start justify-between gap-4">
      <div>
        <legend class="text-[15px] font-semibold">Style</legend>
        <p id="style-selection-help" class="mt-0.5 text-[13px] text-thread-muted">Pick {{ MIN_PROFILE_STYLES }} to {{ MAX_PROFILE_STYLES }} that feel most like you.</p>
      </div>
      <span class="mt-0.5 text-[13px] font-medium tabular-nums" :class="modelValue.length >= MIN_PROFILE_STYLES ? 'text-thread-ink' : 'text-thread-muted'">{{ modelValue.length }}/{{ MAX_PROFILE_STYLES }}</span>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-describedby="style-selection-help">
      <button
        v-for="style in STYLE_OPTIONS"
        :key="style.id"
        type="button"
        class="group relative min-h-[72px] cursor-pointer rounded-2xl p-3.5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-40"
        :class="modelValue.includes(style.id)
          ? 'bg-thread-ink text-thread-on-ink'
          : 'bg-thread-canvas text-thread-ink shadow-inset-hairline enabled:hover:bg-thread-well'"
        :disabled="modelValue.length >= MAX_PROFILE_STYLES && !modelValue.includes(style.id)"
        :aria-pressed="modelValue.includes(style.id)"
        @click="toggle(style.id)"
      >
        <span class="block pr-6 text-[14px] font-medium">{{ style.label }}</span>
        <span class="mt-1 block text-[12px] leading-[1.35]" :class="modelValue.includes(style.id) ? 'text-thread-on-ink/60' : 'text-thread-muted'">{{ style.description }}</span>
        <span class="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full transition" :class="modelValue.includes(style.id) ? 'bg-thread-on-ink text-thread-ink' : 'shadow-control'" aria-hidden="true">
          <Check v-if="modelValue.includes(style.id)" class="h-3 w-3" :stroke-width="3" />
        </span>
      </button>
    </div>
  </fieldset>
</template>
