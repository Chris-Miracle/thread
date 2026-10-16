<script setup lang="ts">
defineProps<{ supported: boolean; registered: boolean }>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-[12px] text-thread-muted" :title="supported ? (registered ? 'Rove tools registered' : 'WebMCP detected but tools not registered') : 'WebMCP is not available in this browser'">
    <span class="h-1.5 w-1.5 rounded-full" :class="supported && registered ? 'bg-thread-success' : 'bg-thread-faint/60'" aria-hidden="true" />
    WebMCP {{ supported && registered ? 'available' : 'not detected' }}
  </span>
</template>
