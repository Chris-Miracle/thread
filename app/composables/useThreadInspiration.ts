import { emptyInspirationState, type InspirationState } from '~/types/thread'

export function useThreadInspiration() {
  const inspiration = useState<InspirationState>('thread-inspiration', emptyInspirationState)
  return { inspiration }
}
