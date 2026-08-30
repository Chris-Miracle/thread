<script setup lang="ts">
defineProps<{ supported: boolean; registered: boolean }>()
</script>

<template>
  <span class="inline-flex items-center gap-2 text-[11px] text-thread-muted" :title="supported ? (registered ? 'Thread tools registered' : 'WebMCP detected but tools not registered') : 'WebMCP is not available in this browser'">
    <span class="h-1.5 w-1.5 rounded-full" :class="supported && registered ? 'bg-emerald-700' : 'border border-thread-muted'" aria-hidden="true" />
    WebMCP {{ supported && registered ? 'available' : 'not detected' }}
  </span>
</template>
