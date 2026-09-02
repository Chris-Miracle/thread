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
    <div class="mb-4 flex items-end justify-between gap-4">
      <div>
        <legend class="text-sm font-medium text-thread-ink">Choose {{ MIN_PROFILE_STYLES }}–{{ MAX_PROFILE_STYLES }} styles.</legend>
        <p id="style-selection-help" class="mt-1 text-xs leading-5 text-thread-muted">Start with your strongest references; you can broaden them over time.</p>
      </div>
      <span class="text-xs tabular-nums" :class="modelValue.length >= MIN_PROFILE_STYLES ? 'text-thread-muted' : 'text-thread-accent'">{{ modelValue.length }} / {{ MAX_PROFILE_STYLES }}</span>
    </div>
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" aria-describedby="style-selection-help">
      <button
        v-for="style in STYLE_OPTIONS"
        :key="style.id"
        type="button"
        class="group relative min-h-24 cursor-pointer rounded-2xl border p-3.5 text-left transition duration-200"
        :class="modelValue.includes(style.id)
          ? 'border-thread-ink bg-thread-ink text-white'
          : 'border-thread-line bg-white/55 text-thread-ink hover:border-thread-accent disabled:cursor-not-allowed disabled:opacity-45'"
        :disabled="modelValue.length >= MAX_PROFILE_STYLES && !modelValue.includes(style.id)"
        :aria-pressed="modelValue.includes(style.id)"
        @click="toggle(style.id)"
      >
        <span class="block pr-5 text-sm font-medium">{{ style.label }}</span>
        <span class="mt-2 block text-[11px] leading-4" :class="modelValue.includes(style.id) ? 'text-white/65' : 'text-thread-muted'">
          {{ style.description }}
        </span>
        <Check v-if="modelValue.includes(style.id)" class="absolute right-3 top-3 h-4 w-4" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>
  </fieldset>
</template>
