<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: 'Nothing quite fits yet.',
  description: 'Try removing one of your filters.',
})
</script>

<template>
  <div class="rove-card px-6 py-14 text-center sm:py-16">
    <span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-thread-canvas text-thread-muted" aria-hidden="true">
      <slot name="icon"><Sparkles class="h-5 w-5" :stroke-width="1.7" /></slot>
    </span>
    <p class="mt-5 text-[19px] font-semibold tracking-[-0.015em]">{{ title }}</p>
    <p class="mx-auto mt-1.5 max-w-md text-pretty text-[15px] leading-[1.5] text-thread-muted">{{ description }}</p>
  </div>
</template>
