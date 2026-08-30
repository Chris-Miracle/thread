import type { AgentProductState } from '~/types/thread'

export function useThreadCatalog() {
  const agentProducts = useState<AgentProductState>('thread-agent-products', () => ({ version: 1, products: [] }))
  return { agentProducts }
}
