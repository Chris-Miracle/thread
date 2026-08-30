<script setup lang="ts">
import { Bug, ChevronDown, RefreshCw } from 'lucide-vue-next'
import { PRODUCTS } from '~/data/products'

const { profile } = useThreadProfile()
const { search } = useThreadSearch()
const { status } = useWebMCPStatus()
const actions = useThreadActions()
const open = ref(true)
const discoveredTools = ref<string[]>([])
const debugError = ref('')

const cart = computed(() => actions.getCart())

async function discoverTools() {
  debugError.value = ''
  try {
    const tools = await document.modelContext?.getTools?.()
    discoveredTools.value = tools?.map(tool => tool.name) ?? []
  } catch (error) {
    debugError.value = error instanceof Error ? error.message : 'Could not inspect tools.'
  }
}

async function runDinnerSearch() {
  debugError.value = ''
  try { await actions.searchProducts({ query: 'relaxed elevated dinner outfit', occasion: 'dinner', maxPrice: 180 }, 'agent') }
  catch (error) { debugError.value = error instanceof Error ? error.message : 'Search failed.' }
}

function addFirstResult() {
  const product = search.value.results.results[0]
  if (!product) {
    debugError.value = 'Run a search before adding the first result.'
    return
  }
  try { actions.addToCart(product.id, {}, 'debug') }
  catch (error) { debugError.value = error instanceof Error ? error.message : 'Add failed.' }
}

async function simulateProgressiveSearch() {
  debugError.value = ''
  try {
    const agent = actions.beginAgentSearch({ query: 'verified dinner pieces under $180 CAD', occasion: 'dinner', maxPrice: 180 })
    const sample = PRODUCTS.slice(0, 2).map(product => ({
      name: product.name,
      brand: product.brand,
      retailer: product.retailer,
      category: product.category,
      gender: product.gender,
      price: product.price,
      currency: product.currency,
      image: product.image,
      url: product.url,
      colors: product.colors,
      sizes: product.sizes,
      styleTags: product.styleTags,
      occasionTags: product.occasionTags,
      description: product.description,
      availability: product.availability,
      observedAt: product.observedAt,
    }))
    actions.publishAgentProducts({ searchId: agent.searchId, query: agent.query, products: [sample[0]!], targetId: 'target:fashion-nova', exploredRetailers: [sample[0]!.retailer] })
    await new Promise(resolve => window.setTimeout(resolve, 350))
    actions.publishAgentProducts({ searchId: agent.searchId, query: agent.query, products: [sample[1]!], targetId: 'target:fashion-nova', targetComplete: true, exploredRetailers: [sample[1]!.retailer] })
    actions.finishAgentSearch(agent.searchId)
  } catch (error) {
    debugError.value = error instanceof Error ? error.message : 'Progressive simulation failed.'
  }
}

onMounted(discoverTools)
</script>

<template>
  <aside class="fixed bottom-4 right-4 z-[80] w-[min(420px,calc(100vw-2rem))] border border-thread-ink bg-[#191916] text-[#f7f3eb] shadow-2xl" aria-label="Thread development panel">
    <button type="button" class="flex min-h-12 w-full cursor-pointer items-center justify-between px-4 text-left" :aria-expanded="open" @click="open = !open">
      <span class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]"><Bug class="h-4 w-4" aria-hidden="true" /> Thread debug</span>
      <ChevronDown class="h-4 w-4 transition" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>
    <div v-if="open" class="thread-scrollbar max-h-[70dvh] overflow-y-auto border-t border-white/15 p-4 text-xs">
      <dl class="grid grid-cols-[130px_1fr] gap-y-2">
        <dt class="text-white/55">WebMCP supported</dt><dd>{{ status.supported ? 'yes' : 'no' }}</dd>
        <dt class="text-white/55">Registered</dt><dd>{{ status.registered ? 'yes' : 'no' }}</dd>
        <dt class="text-white/55">Expected tools</dt><dd>{{ status.toolNames.join(', ') || 'none' }}</dd>
        <dt class="text-white/55">getTools()</dt><dd>{{ discoveredTools.join(', ') || 'unavailable / none' }}</dd>
      </dl>

      <button type="button" class="mt-3 flex min-h-10 cursor-pointer items-center gap-2 border border-white/20 px-3 transition hover:bg-white/10" @click="discoverTools">
        <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" /> Refresh registered tools
      </button>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button type="button" class="col-span-2 min-h-10 cursor-pointer border border-emerald-300/40 px-2 text-emerald-100 transition hover:bg-white/10" @click="simulateProgressiveSearch">Simulate progressive agent</button>
        <button type="button" class="min-h-10 cursor-pointer border border-white/20 px-2 transition hover:bg-white/10" @click="runDinnerSearch">Search dinner look</button>
        <button type="button" class="min-h-10 cursor-pointer border border-white/20 px-2 transition hover:bg-white/10" @click="addFirstResult">Add first result</button>
        <button type="button" class="min-h-10 cursor-pointer border border-white/20 px-2 text-red-200 transition hover:bg-white/10" @click="actions.clearCart">Clear cart</button>
      </div>

      <p v-if="debugError || status.error" class="mt-3 text-red-200">{{ debugError || status.error }}</p>
      <details class="mt-4 border-t border-white/15 pt-3" open>
        <summary class="cursor-pointer font-medium">Current profile JSON</summary>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-4 text-white/65">{{ JSON.stringify(profile, null, 2) }}</pre>
      </details>
      <details class="mt-3 border-t border-white/15 pt-3">
        <summary class="cursor-pointer font-medium">Current cart JSON</summary>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-4 text-white/65">{{ JSON.stringify(cart, null, 2) }}</pre>
      </details>
      <details class="mt-3 border-t border-white/15 pt-3">
        <summary class="cursor-pointer font-medium">Current search state</summary>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-[10px] leading-4 text-white/65">{{ JSON.stringify(search, null, 2) }}</pre>
      </details>
    </div>
  </aside>
</template>
