<script setup lang="ts">
import { ArrowUpRight, ChevronDown } from 'lucide-vue-next'
import { getSessionCollectionProducts } from '~/domain/research/collection'
import { getSearchCoverage } from '~/domain/research/scheduler'
import type { ResearchTargetStatus, SearchSession } from '~/types/thread'

const props = defineProps<{ session: SearchSession }>()
const emit = defineEmits<{ stop: [] }>()
const open = ref(false)
const coverage = computed(() => getSearchCoverage(props.session))
const resolved = computed(() => coverage.value.totalTargets - coverage.value.unresolvedTargets)
const progress = computed(() => coverage.value.totalTargets
  ? Math.round((resolved.value / coverage.value.totalTargets) * 100)
  : 0)
const active = computed(() => props.session.status === 'active')
const collectionCount = computed(() => getSessionCollectionProducts(props.session).length)
const preservedCount = computed(() => props.session.replacementContext?.preservedProducts.length ?? 0)
const summary = computed(() => {
  const parts = [`${coverage.value.acceptedCandidateCount} found`]
  if (coverage.value.rejectedCandidateCount) parts.push(`${coverage.value.rejectedCandidateCount} set aside`)
  if (coverage.value.failedTargets) parts.push(`${coverage.value.failedTargets} unavailable`)
  return parts.join(' · ')
})
const statusLabel: Record<ResearchTargetStatus, string> = {
  queued: 'Queued',
  claimed: 'Starting',
  exploring: 'Searching',
  complete: 'Done',
  'no-results': 'No results',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
}
</script>

<template>
  <section class="rove-card overflow-hidden" aria-labelledby="research-title">
    <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div class="min-w-0">
        <h3 id="research-title" class="text-[15px] font-semibold tracking-[-0.01em]">
          <template v-if="active">Checking {{ coverage.totalTargets }} {{ coverage.totalTargets === 1 ? 'store' : 'stores' }}</template>
          <template v-else>Research complete</template>
          <span class="ml-1.5 font-normal tabular-nums text-thread-muted">{{ resolved }} of {{ coverage.totalTargets }}</span>
        </h3>
        <p class="mt-0.5 text-[13px] tabular-nums text-thread-muted">
          {{ summary }}
          <template v-if="session.replacementContext"> · Keeping {{ preservedCount }} of {{ collectionCount }}</template>
        </p>
      </div>
      <div class="-ml-2 flex items-center gap-1 sm:ml-0">
        <button v-if="active" type="button" class="h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-medium text-thread-danger transition hover:bg-thread-danger/[0.08]" @click="emit('stop')">Stop</button>
        <button type="button" class="flex h-9 cursor-pointer items-center gap-1 rounded-full px-3.5 text-[13px] font-medium text-thread-ink transition hover:bg-thread-fill" :aria-expanded="open" aria-controls="research-plan" @click="open = !open">
          Stores <ChevronDown class="h-4 w-4 text-thread-muted transition duration-300" :class="open ? 'rotate-180' : ''" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="mx-5 mb-5 h-1 overflow-hidden rounded-full bg-thread-fill sm:mx-6" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="Research target completion">
      <div class="h-full rounded-full transition-[width] duration-700 ease-sheet" :class="active ? 'bg-thread-accent' : 'bg-thread-ink'" :style="{ width: `${Math.max(progress, active ? 3 : 0)}%` }" />
    </div>
    <div v-if="open" id="research-plan" class="border-t border-thread-line bg-thread-canvas/60 p-3 sm:p-4">
      <ul class="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="target in session.targets" :key="target.id" class="flex min-w-0 items-start gap-3 rounded-2xl p-3 transition hover:bg-thread-surface">
          <img :src="target.logo" alt="" width="28" height="28" class="h-7 w-7 shrink-0 rounded-[8px] bg-white object-contain p-0.5 shadow-hairline">
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-[13px] font-medium">{{ target.name }}</p>
              <span class="research-status shrink-0" :data-status="target.status">{{ statusLabel[target.status] }}</span>
            </div>
            <p class="mt-0.5 text-[12px] tabular-nums text-thread-muted">{{ target.productCount }} found<template v-if="target.rejectedCount"> · {{ target.rejectedCount }} set aside</template></p>
            <p v-if="target.note" class="mt-1 line-clamp-2 text-[12px] leading-[1.4] text-thread-muted">{{ target.note }}</p>
            <a v-if="target.searchUrls[0]" :href="target.searchUrls[0]" target="_blank" rel="noopener noreferrer" class="mt-1 inline-flex items-center gap-0.5 text-[12px] font-medium text-thread-ink hover:underline">
              Open search <ArrowUpRight class="h-3 w-3" :stroke-width="2" aria-hidden="true" />
            </a>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.research-status {
  border-radius: 999px;
  padding: 0.125rem 0.5rem;
  font-size: 11px;
  font-weight: 500;
  line-height: 1rem;
  color: rgb(var(--rove-muted));
  background: var(--rove-fill);
}
.research-status[data-status='exploring'],
.research-status[data-status='claimed'] {
  color: rgb(var(--rove-accent-ink));
  background: rgb(var(--rove-accent) / 0.12);
}
.research-status[data-status='complete'] {
  color: rgb(var(--rove-success));
  background: rgb(var(--rove-success) / 0.12);
}
.research-status[data-status='skipped'],
.research-status[data-status='cancelled'] {
  color: rgb(var(--rove-faint));
}
.research-status[data-status='failed'] {
  color: rgb(var(--rove-danger));
  background: rgb(var(--rove-danger) / 0.1);
}
</style>
