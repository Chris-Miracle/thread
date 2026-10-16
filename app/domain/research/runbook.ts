import type { ResearchTarget, SearchSession } from '~/types/thread'

/**
 * One concrete step for the browser agent. Rove steps are its WebMCP tools, Shop steps go to the agent's own Shop
 * connection, and browser steps are page visits. Arguments are complete, so an agent can run a mission end to end
 * by executing `next` in order until it is empty or asks for the person.
 */
export interface AgentStep {
  server: 'rove' | 'shop' | 'browser' | 'person'
  tool: string
  arguments?: Record<string, unknown>
  why: string
}

const MAX_BATCH = 4

function targetSteps(target: ResearchTarget, searchId: string): AgentStep[] {
  const publish: AgentStep = {
    server: 'rove',
    tool: 'publish_candidates',
    arguments: { searchId, targetId: target.id },
    why: target.sourceType === 'catalog'
      ? `Publish ${target.name} results with shop provenance; copy url, image, IDs, exact options, product.options (every size and colour), availability, price and checkout_url unchanged. Inspect Shop messages; never invent currency conversions or silently ignore a store filter.`
      : `Publish canonical product pages found for ${target.name}, with every size and colour the listing shows.`,
  }
  const complete: AgentStep = {
    server: 'rove',
    tool: 'complete_search_target',
    arguments: { searchId, targetId: target.id },
    why: target.sourceType === 'catalog'
      ? 'Resolve after inspecting real Shop responses: complete after publication, no-results for zero matching offers, failed for an actual connection/API error with its reason. Missing agent CLI or MCP is not a failure: use search_shop_catalog.'
      : 'Resolve as complete, or no-results/failed with a short reason.',
  }
  if (target.sourceType === 'catalog') {
    const seed = target.seed
    const fetchPin: AgentStep[] = seed?.kind === 'image' && seed.source === 'pinterest' && seed.imageUrl
      ? [{ server: 'browser', tool: 'fetch_image_bytes', arguments: { url: seed.imageUrl }, why: 'Shop visual search needs the pin image as base64 bytes in like[0].image.data.' }]
      : []
    const searches = (target.catalogRequests ?? []).map((_request, requestIndex): AgentStep => ({
      server: 'rove',
      tool: 'search_shop_catalog',
      arguments: { searchId, targetId: target.id, requestIndex },
      why: `${target.name}: Rove executes the planned request through anonymous browser HTTP. Read /shop.md and the official Shop skill; no agent installation or login required.`,
    }))
    return [...fetchPin, ...searches, publish, complete]
  }
  if (target.id === 'discovery:pinterest') {
    return [
      { server: 'browser', tool: 'open', arguments: { url: target.searchUrls[0] }, why: 'Find 3–6 pins that fit the brief.' },
      { server: 'rove', tool: 'add_inspiration', arguments: { searchId, targetId: target.id }, why: 'Pin each look with its image URL and pin URL.' },
      complete,
    ]
  }
  return [
    ...target.searchUrls.slice(0, 2).map((url): AgentStep => ({ server: 'browser', tool: 'open', arguments: { url }, why: `Browse ${target.name} listings.` })),
    publish,
    complete,
  ]
}

export function nextSteps(session: SearchSession | null, claimedTargets?: readonly ResearchTarget[]): AgentStep[] {
  if (!session) {
    return [{ server: 'rove', tool: 'start_shopping_search', why: 'Start a mission from the person’s brief; pass any photo they shared as referenceImage.' }]
  }
  const searchId = session.id
  if (session.status === 'active') {
    const store = session.mission.constraints.storeNames?.[0]
    if (store) return [
      { server: 'browser', tool: 'open', arguments: { url: `https://www.google.com/search?q=${encodeURIComponent(store + ' official store')}` }, why: 'Find and verify the official store domain. Never invent a domain or broaden to other stores.' },
      { server: 'rove', tool: 'resolve_store', arguments: { searchId, name: store }, why: 'Pass the verified official domain, then follow the refreshed next steps. If unresolved, explain the blocker to the person.' },
    ]
    const inFlight = claimedTargets?.length
      ? claimedTargets
      : session.targets.filter(target => target.status === 'claimed' || target.status === 'exploring')
    if (inFlight.length) return inFlight.slice(0, MAX_BATCH).flatMap(target => targetSteps(target, searchId))
    if (session.targets.some(target => target.status === 'queued')) {
      return [{ server: 'rove', tool: 'claim_search_targets', arguments: { searchId, limit: MAX_BATCH }, why: 'Claim the next targets, prioritized around unmet needs.' }]
    }
    return [{ server: 'rove', tool: 'get_search_status', arguments: { searchId }, why: 'Every target is resolved; read the final status.' }]
  }
  const review = session.recommendationReview
  if (review?.status === 'pending') {
    return [
      { server: 'person', tool: 'present_basket', arguments: { searchId, productIds: review.productIds, deadlineAt: review.deadlineAt }, why: 'Show the proposed basket with prices, retailers and links; the person may keep it or mark items to replace.' },
      { server: 'rove', tool: 'review_recommendations', arguments: { searchId, decision: 'accept-all' }, why: 'Only with the person’s approval; otherwise Rove accepts it automatically at the deadline.' },
    ]
  }
  if (review?.status === 'accepted') {
    return [
      { server: 'rove', tool: 'cart_proposed_basket', arguments: { searchId }, why: 'Add the accepted basket to Your Thread in the person’s sizes.' },
      { server: 'rove', tool: 'get_checkout_plan', why: 'Prepare Shop carts per store only when the person asks to check out.' },
    ]
  }
  return []
}
