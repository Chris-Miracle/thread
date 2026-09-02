<script setup lang="ts">
withDefaults(defineProps<{ markOnly?: boolean; compact?: boolean }>(), {
  markOnly: false,
  compact: false,
})
</script>

<template>
  <span class="inline-flex items-center" :class="compact ? 'gap-2.5' : 'gap-3'">
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" :class="compact ? 'h-8 w-8' : 'h-10 w-10'">
      <rect x="1" y="1" width="38" height="38" rx="13" class="fill-white/45 stroke-thread-ink/15" />
      <path d="M12.5 29V11.25h7.15c4.65 0 7.35 2.25 7.35 6.05 0 3.15-1.95 5.25-5.45 5.8L28.25 29" class="stroke-thread-ink" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12.5 21.95h7.05c3.15 0 4.95-1.55 4.95-4.3 0-2.55-1.8-4.05-4.95-4.05H12.5" class="stroke-thread-ink" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="29.4" cy="10.6" r="2.25" class="fill-thread-accent" />
    </svg>
    <span v-if="!markOnly" class="text-sm font-semibold tracking-[0.3em] text-thread-ink">ROVE</span>
  </span>
</template>
