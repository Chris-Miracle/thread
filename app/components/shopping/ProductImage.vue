<script setup lang="ts">
import { Image as ImageIcon } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  width?: number
  height?: number
  fallbackLabel?: string
  fallbackClass?: string
}>(), {
  alt: '',
  width: 720,
  height: 900,
  fallbackLabel: 'Product preview unavailable',
  fallbackClass: 'flex items-center justify-center bg-thread-soft text-thread-muted',
})

const failed = ref(false)

watch(() => props.src, () => {
  failed.value = false
})
</script>

<template>
  <img
    v-if="src && !failed"
    v-bind="$attrs"
    :src="src"
    :alt="alt"
    :width="width"
    :height="height"
    loading="lazy"
    referrerpolicy="no-referrer"
    @error="failed = true"
  >
  <div
    v-else
    v-bind="$attrs"
    :class="fallbackClass"
    role="img"
    :aria-label="fallbackLabel"
  >
    <span class="flex flex-col items-center justify-center gap-2 px-3 text-center">
      <ImageIcon class="h-6 w-6" :stroke-width="1.4" aria-hidden="true" />
      <span class="text-[11px]">Preview unavailable</span>
    </span>
  </div>
</template>
