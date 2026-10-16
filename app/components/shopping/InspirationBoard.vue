<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { InspirationItem } from '~/types/thread'
defineProps<{ items: InspirationItem[]; limit: number; disabled?: boolean }>()
const emit = defineEmits<{ remove: [id: string] }>()
</script>

<template>
  <section class="mt-12 sm:mt-14" aria-labelledby="inspiration-title">
    <div class="flex items-baseline justify-between gap-4">
      <h2 id="inspiration-title" class="text-[15px] font-semibold tracking-[-0.01em]">Reference <span class="font-normal text-thread-muted">· guiding this edit</span></h2>
      <p class="text-[13px] tabular-nums text-thread-muted">{{ items.length }} of {{ limit }}</p>
    </div>

    <div class="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:px-0">
      <figure v-for="item in items" :key="item.id" class="group relative w-32 shrink-0 sm:w-36">
        <ProductImage
          :src="item.imageData ?? item.imageUrl"
          :alt="item.note || (item.source === 'pinterest' ? 'Pinterest inspiration' : 'Your inspiration photo')"
          :width="320"
          :height="400"
          class="aspect-[4/5] w-full rounded-2xl bg-thread-well object-cover"
          fallback-class="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-thread-well text-thread-faint"
          fallback-label="Inspiration image unavailable"
        />
        <button type="button" class="absolute right-2 top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-thread-surface/90 text-thread-ink shadow-raised backdrop-blur transition hover:bg-thread-ink hover:text-thread-on-ink" :aria-label="`Remove ${item.note || 'inspiration'}`" @click="emit('remove', item.id)">
          <X class="h-3.5 w-3.5" :stroke-width="2.2" aria-hidden="true" />
        </button>
        <figcaption class="mt-2 truncate px-0.5 text-[12px] text-thread-muted">
          <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-thread-ink hover:underline">Pinterest</a>
          <template v-else>{{ item.source === 'pinterest' ? 'Pinterest' : 'Your photo' }}</template>
          <template v-if="item.note"> · {{ item.note }}</template>
        </figcaption>
      </figure>
    </div>
  </section>
</template>
