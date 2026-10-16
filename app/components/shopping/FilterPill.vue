<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

defineProps<{
  label: string
  value: string | number
  options: Array<{ value: string | number; label: string }>
  active?: boolean
}>()
const emit = defineEmits<{ change: [value: string] }>()
</script>

<template>
  <label class="relative inline-flex shrink-0">
    <span class="sr-only">{{ label }}</span>
    <select
      :value="value"
      class="h-9 cursor-pointer appearance-none rounded-full border-0 py-0 pl-4 pr-9 text-[13px] font-medium transition duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-thread-accent"
      :class="active ? 'bg-thread-ink text-thread-on-ink' : 'bg-thread-surface text-thread-ink shadow-hairline hover:shadow-hairline-strong'"
      @change="emit('change', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <ChevronDown class="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" :class="active ? 'text-thread-on-ink/70' : 'text-thread-muted'" :stroke-width="2.2" aria-hidden="true" />
  </label>
</template>
