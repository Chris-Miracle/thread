import { emptySearchState, type SearchState } from '~/types/thread'

export function useThreadSearch() {
  const search = useState<SearchState>('thread-search', emptySearchState)
  return { search }
}
