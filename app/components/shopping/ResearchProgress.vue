<script setup lang="ts">
import { ChevronDown, CircleStop, ExternalLink, Search } from 'lucide-vue-next'
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
const statusLabel: Record<ResearchTargetStatus, string> = {
  queued: 'Queued',
  claimed: 'Claimed',
  exploring: 'Exploring',
  complete: 'Complete',
  'no-results': 'No results',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
}
</script>

<template>
  <section class="mb-7 border border-thread-line bg-thread-surface" aria-labelledby="research-title">
    <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div class="flex min-w-0 items-start gap-3">
        <Search class="mt-0.5 h-4 w-4 shrink-0 text-thread-accent" :stroke-width="1.7" aria-hidden="true" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 id="research-title" class="text-sm font-medium">Retailer research</h3>
            <span class="text-xs tabular-nums text-thread-muted">{{ resolved }} / {{ coverage.totalTargets }} targets resolved</span>
          </div>
          <p class="mt-1 text-xs leading-5 text-thread-muted">
            {{ coverage.acceptedCandidateCount }} accepted · {{ coverage.rejectedCandidateCount }} rejected ·
            {{ coverage.activeTargets + coverage.claimedTargets }} active · {{ coverage.failedTargets }} failed · {{ coverage.skippedTargets }} skipped
          </p>
          <p v-if="session.fulfillment.selectedProductIds.length" class="mt-1 text-xs leading-5" :class="session.fulfillment.satisfied ? 'text-green-700' : 'text-thread-muted'">
            {{ session.fulfillment.selectedProductIds.length }} proposed · CAD {{ session.fulfillment.subtotalCad.toFixed(2) }}
            <template v-if="session.fulfillment.overallBudgetCad"> / {{ session.fulfillment.overallBudgetCad.toFixed(2) }}</template>
            <template v-if="session.fulfillment.satisfied"> · Required basket satisfied</template>
            <template v-if="session.recommendationReview?.status === 'pending'"> · Awaiting your review</template>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="session.status === 'active'"
          type="button"
          class="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-medium text-thread-danger transition hover:bg-thread-soft"
          @click="emit('stop')"
        >
          <CircleStop class="h-4 w-4" aria-hidden="true" /> Stop research
        </button>
        <button type="button" class="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-medium text-thread-muted transition hover:text-thread-ink" :aria-expanded="open" @click="open = !open">
          {{ open ? 'Hide plan' : 'View plan' }} <ChevronDown class="h-4 w-4 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="h-1 bg-thread-soft" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="Research target completion">
      <div class="h-full bg-thread-ink transition-[width] duration-300" :style="{ width: `${progress}%` }" />
    </div>
    <div v-if="open" class="border-t border-thread-line p-4 sm:p-5">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <article v-for="target in session.targets" :key="target.id" class="min-w-0 border border-thread-line bg-thread-canvas p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <img :src="target.logo" alt="" width="24" height="24" class="h-6 w-6 rounded border border-thread-line bg-white object-contain p-0.5">
              <div class="min-w-0">
                <p class="truncate text-xs font-medium">{{ target.name }}</p>
                <p class="mt-0.5 text-[10px] text-thread-muted">Rank {{ target.rank }} · priority {{ target.priorityScore.toFixed(1) }}</p>
              </div>
            </div>
            <span class="research-status shrink-0" :data-status="target.status">{{ statusLabel[target.status] }}</span>
          </div>
          <p class="mt-3 text-[11px] leading-4 text-thread-muted">{{ target.productCount }} accepted · {{ target.rejectedCount }} rejected</p>
          <p v-if="target.note" class="mt-2 text-[11px] leading-4 text-thread-muted">{{ target.note }}</p>
          <a v-if="target.searchUrls[0]" :href="target.searchUrls[0]" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex min-h-8 items-center gap-1 text-[11px] font-medium underline decoration-thread-line underline-offset-4">
            Open top query <ExternalLink class="h-3 w-3" aria-hidden="true" />
          </a>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.research-status {
  border: 1px solid rgb(216 210 199);
  padding: 0.2rem 0.4rem;
  font-size: 0.625rem;
  line-height: 1rem;
  color: rgb(111 107 98);
}
.research-status[data-status='exploring'],
.research-status[data-status='claimed'] {
  border-color: rgb(122 103 79);
  color: rgb(91 72 49);
}
.research-status[data-status='complete'] {
  border-color: rgb(21 128 61 / 0.35);
  color: rgb(21 128 61);
}
.research-status[data-status='skipped'] {
  border-color: rgb(111 107 98 / 0.3);
  color: rgb(111 107 98);
  background: rgb(244 241 235);
}
.research-status[data-status='failed'] {
  border-color: rgb(159 52 45 / 0.4);
  color: rgb(159 52 45);
}
</style>
