<script setup lang="ts">
withDefaults(defineProps<{ markOnly?: boolean; compact?: boolean }>(), {
  markOnly: false,
  compact: false,
})
</script>

<template>
  <span class="inline-flex items-center" :class="compact ? 'gap-2' : 'gap-2.5'">
    <!-- The squircle inverts with the colour scheme so the mark never sinks into the canvas. -->
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" :class="compact ? 'h-7 w-7' : 'h-10 w-10'">
      <rect width="40" height="40" rx="11" class="fill-thread-ink" />
      <path d="M13 29V11.75h6.9c4.5 0 7.1 2.2 7.1 5.9 0 3.05-1.9 5.1-5.3 5.6L27.6 29" class="stroke-thread-on-ink" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M13 22.2h6.8c3.05 0 4.8-1.5 4.8-4.15 0-2.5-1.75-3.95-4.8-3.95H13" class="stroke-thread-on-ink" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="30" cy="10" r="2.6" class="fill-thread-accent" />
    </svg>
    <span v-if="!markOnly" class="font-display font-semibold tracking-[-0.02em] text-thread-ink" :class="compact ? 'text-[17px]' : 'text-xl'">Rove</span>
  </span>
</template>
