import { describe, expect, it } from 'vitest'
import type { AgentStep } from '../app/domain/research/runbook'
import type { ProductCandidateInput, ProductCategory, ShopCatalogQuery, StyleProfile } from '../app/types/thread'
import { DEFAULT_PROFILE, FLAGSHIP_BRIEF, makeActions } from './helpers'

const PROFILE: StyleProfile = { ...DEFAULT_PROFILE, clothingSizes: { tops: 'M', bottoms: 'M' }, shoeSize: '8' }
const UPLOAD = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJ'

const QUERY_CATEGORIES: Array<[RegExp, ProductCategory]> = [
  [/sandal|espadrille|slide|sneaker|boot/, 'footwear'],
  [/parfum|perfume|fragrance|cologne/, 'fragrance'],
  [/swim|bikini/, 'swimwear'],
  [/dress/, 'dresses'],
  [/short|pant|trouser|skirt/, 'bottoms'],
  [/shirt|top|tee|blouse|polo/, 'tops'],
]
const STYLE_WORDS = ['Riviera', 'Coastal', 'Breeze', 'Solstice', 'Marina', 'Lagoon']
const PRICE_POINTS = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95]

/** A deterministic stand-in for Shop search_catalog: six in-stock products under the request's price cap. */
function fakeSearchCatalog(catalog: ShopCatalogQuery, counter: { next: number }): ProductCandidateInput[] {
  const query = catalog.query ?? 'pieces like the photo'
  const category = QUERY_CATEGORIES.find(([pattern]) => pattern.test(query))?.[1] ?? 'tops'
  const capCad = (catalog.filters?.price?.max ?? 10_000) / 100
  return PRICE_POINTS.map((point, index) => {
    counter.next += 1
    const id = counter.next
    const name = `${STYLE_WORDS[index]} ${query}${catalog.like ? ' (visual match)' : ''}`
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return {
      url: `https://store${id}.example-shop.com/products/${slug}?variant=${id}&_gsid=x${id}`,
      name,
      image: `https://cdn.shopify.com/s/files/test/${slug}.jpg`,
      category,
      shoppingDepartment: 'women',
      shop: {
        productId: `gid://shopify/p/${id}`,
        variantId: `gid://shopify/ProductVariant/${id}`,
        sellerDomain: `store${id}.myshopify.com`,
        sellerName: `Store ${id}`,
        price: { amount: Math.round(capCad * point * 100), currency: 'CAD' },
        available: true,
        selectedOptions: [],
      },
    }
  })
}

/** Stand-in for Shop get_product: the listing's sizes and the exact variant for the requested size. */
function fakeGetProduct(productId: string, size: string | undefined) {
  const id = productId.split('/').at(-1)
  return {
    sizes: size ? ['XS', 'S', 'M', 'L', 'XL', '6', '7', '8', '9'] : [],
    variants: [{ id: `gid://shopify/ProductVariant/${id}-${size ?? 'one'}`, options: size ? [{ name: 'Size', label: size }] : [], available: true }],
  }
}

/**
 * A browser agent that only does what Rove's `next` steps say. It has Shop but browses no retailer pages, so retailer
 * and Pinterest targets resolve as no-results; that is enough for a Shop-backed mission to finish.
 */
function runAgent(harness: ReturnType<typeof makeActions>, firstSteps: AgentStep[]) {
  const { actions } = harness
  const counter = { next: 0 }
  const log: string[] = []
  let steps = firstSteps
  let pending: ProductCandidateInput[] = []
  const published = new Map<string, number>()
  for (let guard = 0; steps.length && guard < 400; guard += 1) {
    const step = steps.shift()!
    log.push(`${step.server}:${step.tool}`)
    const args = (step.arguments ?? {}) as Record<string, any>
    if (step.server === 'rove' && step.tool === 'search_shop_catalog') {
      pending.push(...fakeSearchCatalog(actions.getShopRequest(args.searchId, args.targetId, args.requestIndex).request.arguments.catalog, counter))
    } else if (step.server === 'rove' && step.tool === 'publish_candidates') {
      if (pending.length) {
        const result = actions.publishCandidates({ searchId: args.searchId, targetId: args.targetId, candidates: pending.slice(0, 40) })
        published.set(args.targetId, result.accepted.length)
      }
      pending = []
    } else if (step.server === 'rove' && step.tool === 'complete_search_target') {
      const accepted = published.get(args.targetId) ?? 0
      const result = actions.completeSearchTarget({
        searchId: args.searchId,
        targetId: args.targetId,
        status: accepted ? 'complete' : 'no-results',
        note: accepted ? undefined : 'Not browsed by this agent.',
      })
      // A batch is done when its last target resolves; then follow Rove's next steps again.
      if (!steps.length) steps = result.next
    } else if (step.server === 'rove' && step.tool === 'claim_search_targets') {
      steps = actions.claimSearchTargets(args as { searchId: string; limit: number }).next
    } else if (step.server === 'rove' && step.tool === 'get_search_status') {
      steps = actions.getSearchStatus(args.searchId).next
    } else if (step.server === 'person' && step.tool === 'present_basket') {
      // The person looks at the basket and approves it.
    } else if (step.server === 'rove' && step.tool === 'review_recommendations') {
      steps = actions.reviewRecommendations({ searchId: args.searchId, decision: 'accept-all' }).next
    } else if (step.server === 'rove' && step.tool === 'cart_proposed_basket') {
      const basket = actions.cartProposedBasket({ searchId: args.searchId })
      steps = basket.needsAction.length ? basket.next : []
    } else if (step.server === 'rove' && step.tool === 'inspect_shop_product') {
      const pendingProduct = harness.actions.getProductById((steps[0]?.arguments as { productId: string }).productId)!
      const wantedSize = pendingProduct.category === 'fragrance' ? undefined : pendingProduct.category === 'footwear' ? harness.profile.value?.shoeSize : harness.profile.value?.clothingSizes?.[pendingProduct.category as 'tops' | 'bottoms'] ?? harness.profile.value?.clothingSizes?.tops
      const details = fakeGetProduct(pendingProduct.commerce!.productId, args.requestedOptions?.find((option: { name: string }) => option.name === 'Size')?.label ?? wantedSize)
      const enrich = steps.shift()!
      const enrichArgs = enrich.arguments as { searchId: string; productId: string }
      const current = actions.getProductById(enrichArgs.productId)!
      actions.enrichProduct(enrichArgs.searchId, { productId: enrichArgs.productId, ...details, requestedOptions: details.variants[0]!.options, variants: details.variants.map(variant => ({ ...variant, price: { amount: Math.round(current.priceCad! * 100), currency: 'CAD' } })), availability: 'in-stock' })
      if (!steps.length) steps = [{ server: 'rove', tool: 'cart_proposed_basket', arguments: { searchId: enrichArgs.searchId }, why: 'retry' }]
    }
    // Browser steps (open, fetch_image_bytes) and add_inspiration are skipped by this agent.
  }
  return log
}

describe('hands-off flagship mission', () => {
  it('turns the Cancun brief into a six-piece basket under CAD 450 in the person’s sizes', () => {
    const harness = makeActions({ profile: PROFILE })
    const started = harness.actions.startGuidedSearch({ rawPrompt: FLAGSHIP_BRIEF }, {}, 'agent')
    expect(started.guide).toBeNull()
    expect(started.next).toEqual([expect.objectContaining({ server: 'rove', tool: 'claim_search_targets' })])

    const log = runAgent(harness, started.next)
    expect(log[0]).toBe('rove:claim_search_targets')
    expect(log).toContain('rove:search_shop_catalog')

    const cart = harness.actions.getCart()
    const categories = cart.items.map(item => item.product.category)
    expect(cart.items).toHaveLength(6)
    expect(cart.totals[0]!.subtotal).toBeLessThanOrEqual(450)
    expect(categories.filter(category => category === 'fragrance')).toHaveLength(1)
    expect(categories.filter(category => category === 'footwear')).toHaveLength(2)
    const clothing = categories.filter(category => category !== 'fragrance' && category !== 'footwear')
    expect(clothing).toHaveLength(3)
    expect(new Set(clothing).size).toBeGreaterThanOrEqual(2)
    // Sized pieces carry the person's size and the exact Shop variant.
    for (const item of cart.items) {
      if (item.product.category === 'fragrance') continue
      expect(item.size).toBe(item.product.category === 'footwear' ? '8' : 'M')
      expect(item.variantId).toMatch(/^gid:\/\/shopify\/ProductVariant\//)
    }
    // Research stopped once the basket was ready, leaving browsing it no longer needed as skipped.
    const finished = harness.search.value.activeSearch!
    expect(finished.status).toBe('satisfied')
    expect(finished.targets.some(target => target.status === 'skipped')).toBe(true)
  })

  it('uses a photo in the brief as the style guide for every wearable need, but not the perfume', () => {
    const harness = makeActions({ profile: PROFILE })
    const started = harness.actions.startGuidedSearch({ rawPrompt: FLAGSHIP_BRIEF }, { imageData: UPLOAD, palette: ['white', 'tan'], descriptors: ['relaxed linen'] }, 'agent')
    expect(started.guide).toMatchObject({ palette: ['white', 'tan'], descriptors: ['relaxed linen'] })

    const session = harness.search.value.activeSearch!
    const visual = session.targets.filter(target => target.seed)
    expect(visual.map(target => target.needIds[0])).toEqual([session.mission.needs[0]!.id, session.mission.needs[2]!.id])
    expect(visual.map(target => target.rank)).toEqual([1, 2])
    expect(JSON.stringify(session)).not.toContain('/9j/4AAQ')

    const claimed = harness.actions.claimSearchTargets({ searchId: started.searchId, limit: 4 })
    expect(claimed.targets.slice(0, 2).every(target => target.seed)).toBe(true)
    const firstVisual = claimed.targets[0]!.catalogRequests![0]!.arguments.catalog
    expect(firstVisual).toMatchObject({ query: 'linen shirt', like: [{ image: { content_type: 'image/jpeg' } }] })
    expect(firstVisual.context.intent).toContain('like the reference photo: white, tan, relaxed linen')
    expect(harness.actions.getInspiration()[0]).toMatchObject({ source: 'upload', searchId: started.searchId })

    runAgent(harness, claimed.next)
    const products = harness.search.value.activeSearch!.products
    const visualMatches = products.filter(item => item.name.includes('(visual match)'))
    const plain = products.filter(item => !item.name.includes('(visual match)') && item.category !== 'fragrance')
    const average = (items: typeof products) => items.reduce((sum, item) => sum + item.relevanceScore, 0) / items.length
    expect(average(visualMatches)).toBeGreaterThan(average(plain))
    expect(harness.actions.getCart().items).toHaveLength(6)
  })

  it('removes a just-uploaded guide image when the mission cannot start', () => {
    const harness = makeActions({ profile: PROFILE })
    expect(() => harness.actions.startGuidedSearch({ rawPrompt: '   ' }, { imageData: UPLOAD })).toThrow('rawPrompt')
    expect(harness.actions.getInspiration()).toEqual([])
  })
})
