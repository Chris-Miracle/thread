import { resolveStoreTool } from '~/webmcp/tools/resolveStore'
import { searchShopCatalogTool } from '~/webmcp/tools/searchShopCatalog'
import { inspectShopProductTool } from '~/webmcp/tools/inspectShopProduct'
import type { createThreadActions } from '~/domain/threadActions'
import { addInspirationTool } from '~/webmcp/tools/addInspiration'
import { addToCartTool } from '~/webmcp/tools/addToCart'
import { attachMerchantCartTool } from '~/webmcp/tools/attachMerchantCart'
import { cartProposedBasketTool } from '~/webmcp/tools/cartProposedBasket'
import { cancelSearchTool } from '~/webmcp/tools/cancelSearch'
import { claimSearchTargetsTool } from '~/webmcp/tools/claimSearchTargets'
import { completeSearchTargetTool } from '~/webmcp/tools/completeSearchTarget'
import { enrichProductTool } from '~/webmcp/tools/enrichProduct'
import { findSimilarTool } from '~/webmcp/tools/findSimilar'
import { getCartTool } from '~/webmcp/tools/getCart'
import { getCheckoutPlanTool } from '~/webmcp/tools/getCheckoutPlan'
import { getInspirationTool } from '~/webmcp/tools/getInspiration'
import { getProductsTool } from '~/webmcp/tools/getProducts'
import { getProfileTool } from '~/webmcp/tools/getProfile'
import { getResearchHistoryTool } from '~/webmcp/tools/getResearchHistory'
import { getSearchStatusTool } from '~/webmcp/tools/getSearchStatus'
import { publishCandidatesTool } from '~/webmcp/tools/publishCandidates'
import { recordPurchasesTool } from '~/webmcp/tools/recordPurchases'
import { removeFromCartTool } from '~/webmcp/tools/removeFromCart'
import { researchAgainTool } from '~/webmcp/tools/researchAgain'
import { reviewRecommendationsTool } from '~/webmcp/tools/reviewRecommendations'
import { setupProfileTool } from '~/webmcp/tools/setupProfile'
import { startShoppingSearchTool } from '~/webmcp/tools/startShoppingSearch'
import { updateProfileTool } from '~/webmcp/tools/updateProfile'

type ThreadActions = ReturnType<typeof createThreadActions>

export const THREAD_TOOL_NAMES = [
  'get_profile',
  'setup_profile',
  'update_profile',
  'start_shopping_search',
  'claim_search_targets',
  'search_shop_catalog',
  'inspect_shop_product',
  'resolve_store',
  'publish_candidates',
  'enrich_product',
  'complete_search_target',
  'get_search_status',
  'get_products',
  'review_recommendations',
  'research_again',
  'get_research_history',
  'cancel_search',
  'get_cart',
  'add_to_cart',
  'remove_from_cart',
  'get_checkout_plan',
  'attach_merchant_cart',
  'add_inspiration',
  'get_inspiration',
  'find_similar',
  'record_purchases',
  'cart_proposed_basket',
] as const

type ThreadWindow = Window & { __threadWebMCPController?: AbortController }

export function createThreadToolDefinitions(actions: ThreadActions) {
  return [
    getProfileTool(actions),
    setupProfileTool(actions),
    updateProfileTool(actions),
    startShoppingSearchTool(actions),
    claimSearchTargetsTool(actions),
    searchShopCatalogTool(actions),
    inspectShopProductTool(actions),
    resolveStoreTool(actions),
    publishCandidatesTool(actions),
    enrichProductTool(actions),
    completeSearchTargetTool(actions),
    getSearchStatusTool(actions),
    getProductsTool(actions),
    reviewRecommendationsTool(actions),
    researchAgainTool(actions),
    getResearchHistoryTool(actions),
    cancelSearchTool(actions),
    getCartTool(actions),
    addToCartTool(actions),
    removeFromCartTool(actions),
    getCheckoutPlanTool(actions),
    attachMerchantCartTool(actions),
    addInspirationTool(actions),
    getInspirationTool(actions),
    findSimilarTool(actions),
    recordPurchasesTool(actions),
    cartProposedBasketTool(actions),
  ]
}

export async function registerThreadTools(actions: ThreadActions): Promise<string[]> {
  const modelContext = document.modelContext
  if (!modelContext) return []
  const threadWindow = window as ThreadWindow
  if (threadWindow.__threadWebMCPController && !threadWindow.__threadWebMCPController.signal.aborted) {
    return [...THREAD_TOOL_NAMES]
  }
  const controller = new AbortController()
  threadWindow.__threadWebMCPController = controller
  const tools = createThreadToolDefinitions(actions)
  try {
    for (const tool of tools) await modelContext.registerTool(tool, { signal: controller.signal })
    return tools.map(tool => tool.name)
  } catch (error) {
    controller.abort()
    delete threadWindow.__threadWebMCPController
    throw error
  }
}

export function unregisterThreadTools(): void {
  const threadWindow = window as ThreadWindow
  threadWindow.__threadWebMCPController?.abort()
  delete threadWindow.__threadWebMCPController
}
