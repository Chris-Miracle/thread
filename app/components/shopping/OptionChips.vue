<script setup lang="ts">
const props = defineProps<{
  label: string
  modelValue: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const groupId = useId()
const selectedLabel = computed(() => props.options.find(option => option.value === props.modelValue)?.label)
</script>

<template>
  <div>
    <p :id="groupId" class="flex items-baseline gap-2 text-[13px]">
      <span class="font-medium text-thread-ink">{{ label }}</span>
      <span v-if="selectedLabel" class="truncate text-thread-muted">{{ selectedLabel }}</span>
    </p>
    <div class="mt-2.5 flex flex-wrap gap-2" role="radiogroup" :aria-labelledby="groupId">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="option.value === modelValue"
        :disabled="option.disabled"
        class="min-h-11 min-w-[52px] cursor-pointer rounded-xl bg-thread-surface px-3.5 text-[14px] transition duration-150 disabled:cursor-not-allowed disabled:text-thread-faint disabled:line-through"
        :class="option.value === modelValue
          ? 'font-medium shadow-selected'
          : 'shadow-control enabled:hover:shadow-control-hover'"
        @click="emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
