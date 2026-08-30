import { emptySearchLane, type SearchState } from '~/types/thread'

export function useThreadSearch() {
  const search = useState<SearchState>('thread-search', () => ({
    results: emptySearchLane(),
  }))
  return { search }
}
