import type { WebMCPStatusState } from '~/types/thread'

export function useWebMCPStatus() {
  const status = useState<WebMCPStatusState>('thread-webmcp-status', () => ({
    supported: false,
    registered: false,
    toolNames: [],
    error: null,
  }))
  return { status }
}
