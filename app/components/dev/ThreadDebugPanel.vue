<script setup lang="ts">
import { Bug, ChevronDown, RefreshCw } from 'lucide-vue-next'
import { PRODUCTS } from '~/data/products'

const open = ref(false)
const debugError = ref('')
const discoveredTools = ref<string[]>([])
const { status } = useWebMCPStatus()
const { profile } = useThreadProfile()
const { cart } = useThreadCart()
const { search } = useThreadSearch()
const actions = useThreadActions()
const trace = computed(() => actions.getExecutionTrace().toReversed())

async function discoverTools() {
  debugError.value = ''
  try {
    const tools = await document.modelContext?.getTools?.()
    discoveredTools.value = tools?.map(tool => tool.name) ?? []
  } catch (error) {
    debugError.value = error instanceof Error ? error.message : 'Could not inspect tools.'
  }
}

function candidateFromFixture(product: typeof PRODUCTS[number]) {
  if (!product.image) throw new Error(`Debug fixture ${product.name} is missing its required product image.`)
  return {
    url: product.url,
    name: product.name,
    brand: product.brand,
    nativePrice: product.nativePrice,
    nativeCurrency: product.nativeCurrency,
    priceCad: product.priceCad,
    image: product.image,
    category: product.category,
    shoppingDepartment: product.shoppingDepartment,
  }
}

function enrichmentFromFixture(product: typeof PRODUCTS[number]) {
  return {
    productId: product.id,
    brand: product.brand,
    nativePrice: product.nativePrice,
    nativeCurrency: product.nativeCurrency,
    priceCad: product.priceCad,
    image: product.image,
    category: product.category,
    shoppingDepartment: product.shoppingDepartment,
    colors: product.colors,
    sizes: product.sizes,
    styleTags: product.styleTags,
    occasionTags: product.occasionTags,
    description: product.description,
    availability: product.availability,
  }
}

function simulateMission() {
  debugError.value = ''
  try {
    const started = actions.startShoppingSearch({
      rawPrompt: 'Find dinner pieces from Fashion Nova and SHEIN under $180 CAD',
      context: { occasions: ['dinner'] },
      constraints: { maxPriceCad: 180, retailerIds: ['fashion-nova', 'shein'] },
      needs: [{ intent: 'relaxed dinner', queries: ['relaxed dinner outfit', 'dinner dress'], categories: ['dresses', 'tops'], required: true }],
    })
    const claimed = actions.claimSearchTargets({ searchId: started.searchId, limit: 2, workerId: 'debug-panel' })
    for (const target of claimed.targets) {
      const fixture = PRODUCTS.find(product => product.retailerId === target.retailerId && ['dresses', 'tops'].includes(product.category ?? ''))
      if (!fixture) {
        actions.completeSearchTarget({ searchId: started.searchId, targetId: target.id, status: 'no-results', note: 'No matching debug fixture.' })
        continue
      }
      const published = actions.publishCandidates({ searchId: started.searchId, targetId: target.id, candidates: [candidateFromFixture(fixture)] })
      const candidate = published.accepted[0]
      if (candidate) actions.enrichProduct(started.searchId, { ...enrichmentFromFixture(fixture), productId: candidate.id })
      actions.completeSearchTarget({ searchId: started.searchId, targetId: target.id, status: 'complete', note: 'Debug fixture published and enriched.' })
    }
  } catch (error) {
    debugError.value = error instanceof Error ? error.message : 'Simulation failed.'
  }
}

function addFirstResult() {
  debugError.value = ''
  const product = search.value.activeSearch?.products.find(item => item.stage === 'enriched')
  if (!product) {
    debugError.value = 'No enriched product is available.'
    return
  }
  try {
    actions.addToCart(product.id, { size: product.sizes[0], color: product.colors[0] }, 'debug')
  } catch (error) {
    debugError.value = error instanceof Error ? error.message : 'Could not add product.'
  }
}
</script>

<template>
  <aside class="fixed bottom-4 right-4 z-[80] w-[min(92vw,620px)] border border-white/20 bg-[#25221d] text-[#f7f3eb] shadow-2xl" aria-label="THREAD development panel">
    <button type="button" class="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 text-left" :aria-expanded="open" @click="open = !open">
      <span class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]"><Bug class="h-4 w-4" aria-hidden="true" /> THREAD debug</span>
      <ChevronDown class="h-4 w-4 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>
    <div v-if="open" class="thread-scrollbar max-h-[76dvh] overflow-y-auto border-t border-white/15 p-4 text-xs">
      <dl class="grid grid-cols-[130px_1fr] gap-y-2">
        <dt class="text-white/55">WebMCP supported</dt><dd>{{ status.supported ? 'yes' : 'no' }}</dd>
        <dt class="text-white/55">Registered</dt><dd>{{ status.registered ? 'yes' : 'no' }}</dd>
        <dt class="text-white/55">Expected tools</dt><dd class="break-words">{{ status.toolNames.join(', ') || 'none' }}</dd>
        <dt class="text-white/55">getTools()</dt><dd class="break-words">{{ discoveredTools.join(', ') || 'unavailable / none' }}</dd>
      </dl>

      <button type="button" class="mt-3 flex min-h-10 cursor-pointer items-center gap-2 border border-white/20 px-3 transition hover:bg-white/10" @click="discoverTools">
        <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" /> Refresh registered tools
      </button>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button type="button" class="col-span-2 min-h-10 cursor-pointer border border-emerald-300/40 px-2 text-emerald-100 transition hover:bg-white/10" @click="simulateMission">Simulate complete mission workflow</button>
        <button type="button" class="min-h-10 cursor-pointer border border-white/20 px-2 transition hover:bg-white/10" @click="addFirstResult">Add first enriched result</button>
        <button type="button" class="min-h-10 cursor-pointer border border-white/20 px-2 text-red-200 transition hover:bg-white/10" @click="actions.clearCart">Clear cart</button>
      </div>

      <p v-if="debugError || status.error" class="mt-3 text-red-200">{{ debugError || status.error }}</p>

      <details class="mt-4 border-t border-white/15 pt-3" open>
        <summary class="cursor-pointer font-medium">Execution trace (newest first)</summary>
        <ol v-if="trace.length" class="mt-2 space-y-2">
          <li v-for="event in trace" :key="event.id" class="border-l border-white/20 pl-2">
            <p class="text-[10px] uppercase tracking-[0.1em] text-white/45">{{ event.type }} · {{ new Date(event.at).toLocaleTimeString() }}</p>
            <p class="mt-0.5 text-[11px] leading-4 text-white/75">{{ event.message }}</p>
          </li>
        </ol>
        <p v-else class="mt-2 text-white/50">No search events yet.</p>
      </details>
      <details class="mt-3 border-t border-white/15 pt-3">
        <summary class="cursor-pointer font-medium">Current profile JSON</summary>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-4 text-white/65">{{ JSON.stringify(profile, null, 2) }}</pre>
      </details>
      <details class="mt-3 border-t border-white/15 pt-3">
        <summary class="cursor-pointer font-medium">Current cart JSON</summary>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-4 text-white/65">{{ JSON.stringify(cart, null, 2) }}</pre>
      </details>
      <details class="mt-3 border-t border-white/15 pt-3">
        <summary class="cursor-pointer font-medium">Current mission state</summary>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-4 text-white/65">{{ JSON.stringify(search.activeSearch, null, 2) }}</pre>
      </details>
    </div>
  </aside>
</template>
