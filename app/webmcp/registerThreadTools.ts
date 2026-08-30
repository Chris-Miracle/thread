import type { createThreadActions } from '~/domain/threadActions'
import { addToCartTool } from '~/webmcp/tools/addToCart'
import { beginRetailerSearchTool } from '~/webmcp/tools/beginRetailerSearch'
import { getCartTool } from '~/webmcp/tools/getCart'
import { getRetailersTool } from '~/webmcp/tools/getRetailers'
import { getStyleProfileTool } from '~/webmcp/tools/getStyleProfile'
import { getVisibleProductsTool } from '~/webmcp/tools/getVisibleProducts'
import { getResearchProgressTool } from '~/webmcp/tools/getResearchProgress'
import { finishRetailerSearchTool } from '~/webmcp/tools/finishRetailerSearch'
import { planDeepSearchTool } from '~/webmcp/tools/planDeepSearch'
import { publishProductsTool } from '~/webmcp/tools/publishProducts'
import { reportResearchTargetTool } from '~/webmcp/tools/reportResearchTarget'
import { removeFromCartTool } from '~/webmcp/tools/removeFromCart'
import { searchProductsTool } from '~/webmcp/tools/searchProducts'
import { setupProfileTool } from '~/webmcp/tools/setupProfile'

type ThreadActions = ReturnType<typeof createThreadActions>

export const THREAD_TOOL_NAMES = [
  'setup_profile',
  'get_style_profile',
  'get_retailers',
  'search_products',
  'begin_retailer_search',
  'plan_deep_search',
  'get_research_progress',
  'report_research_target',
  'publish_products',
  'finish_retailer_search',
  'get_visible_products',
  'add_to_cart',
  'remove_from_cart',
  'get_cart',
] as const

type ThreadWindow = Window & { __threadWebMCPController?: AbortController }

export async function registerThreadTools(actions: ThreadActions): Promise<string[]> {
  const modelContext = document.modelContext
  if (!modelContext) return []

  const threadWindow = window as ThreadWindow
  if (threadWindow.__threadWebMCPController && !threadWindow.__threadWebMCPController.signal.aborted) {
    return [...THREAD_TOOL_NAMES]
  }

  const controller = new AbortController()
  threadWindow.__threadWebMCPController = controller
  const tools = [
    setupProfileTool(actions),
    getStyleProfileTool(actions),
    getRetailersTool(actions),
    searchProductsTool(actions),
    beginRetailerSearchTool(actions),
    planDeepSearchTool(actions),
    getResearchProgressTool(actions),
    reportResearchTargetTool(actions),
    publishProductsTool(actions),
    finishRetailerSearchTool(actions),
    getVisibleProductsTool(actions),
    addToCartTool(actions),
    removeFromCartTool(actions),
    getCartTool(actions),
  ]

  try {
    for (const tool of tools) {
      await modelContext.registerTool(tool, { signal: controller.signal })
    }
    return tools.map(tool => tool.name)
  } catch (error) {
    controller.abort()
    delete threadWindow.__threadWebMCPController
    throw error
  }
}

export function unregisterThreadTools() {
  const threadWindow = window as ThreadWindow
  threadWindow.__threadWebMCPController?.abort()
  delete threadWindow.__threadWebMCPController
}
