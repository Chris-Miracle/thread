<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: 'Nothing quite fits yet.',
  description: 'Try removing one of your filters.',
})
</script>

<template>
  <div class="border border-thread-line bg-thread-surface px-6 py-16 text-center">
    <p class="font-editorial text-3xl">{{ title }}</p>
    <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-thread-muted">{{ description }}</p>
  </div>
</template>
