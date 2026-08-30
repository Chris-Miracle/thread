<script setup lang="ts">
import { Check, CircleAlert, ExternalLink, LoaderCircle, Search, Store } from 'lucide-vue-next'
import type { ResearchTarget } from '~/types/thread'

const props = defineProps<{ targets: ResearchTarget[]; searching: boolean }>()
const completed = computed(() => props.targets.filter(target => ['complete', 'no-results', 'error'].includes(target.status)).length)
const active = computed(() => props.targets.filter(target => target.status === 'exploring').length)

function statusLabel(target: ResearchTarget) {
  if (target.status === 'no-results') return 'Checked · no matches'
  if (target.status === 'complete') return `Checked · ${target.productCount} ${target.productCount === 1 ? 'find' : 'finds'}`
  if (target.status === 'exploring') return 'Searching now'
  if (target.status === 'error') return 'Could not search'
  return 'Queued'
}
</script>

<template>
  <details v-if="targets.length" class="mb-7 border border-thread-line bg-thread-surface" :open="searching">
    <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:hidden sm:px-5">
      <span class="flex min-w-0 items-center gap-3">
        <LoaderCircle v-if="searching" class="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        <Search v-else class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span><span class="block text-sm font-medium">Deep retailer research</span><span class="block text-xs text-thread-muted">{{ completed }} of {{ targets.length }} sources checked<span v-if="active"> · {{ active }} active</span></span></span>
      </span>
      <span class="text-xs text-thread-muted">Open plan</span>
    </summary>
    <div class="grid gap-px border-t border-thread-line bg-thread-line sm:grid-cols-2 lg:grid-cols-3">
      <a v-for="target in targets" :key="target.id" :href="target.url" target="_blank" rel="noopener noreferrer" class="group flex min-h-16 cursor-pointer items-center gap-3 bg-thread-surface px-4 py-3 transition hover:bg-thread-soft" :aria-label="`Open ${target.name} search — ${statusLabel(target)}`">
        <img :src="target.logo" :alt="`${target.name} logo`" class="h-7 w-7 shrink-0 object-contain" width="28" height="28">
        <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{{ target.name }}</span><span class="flex items-center gap-1 text-xs text-thread-muted"><LoaderCircle v-if="target.status === 'exploring'" class="h-3 w-3 animate-spin" aria-hidden="true" /><Check v-else-if="target.status === 'complete' || target.status === 'no-results'" class="h-3 w-3" aria-hidden="true" /><CircleAlert v-else-if="target.status === 'error'" class="h-3 w-3" aria-hidden="true" /><Store v-else class="h-3 w-3" aria-hidden="true" />{{ statusLabel(target) }}</span></span>
        <ExternalLink class="h-3.5 w-3.5 shrink-0 text-thread-muted transition group-hover:text-thread-ink" aria-hidden="true" />
      </a>
    </div>
    <p class="border-t border-thread-line px-4 py-3 text-xs leading-5 text-thread-muted sm:px-5">You can open any search and browse alongside the agent. Products only enter THREAD after their canonical retailer page is verified.</p>
  </details>
</template>
