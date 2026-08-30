import type { StyleProfile } from '~/types/thread'

export function useThreadProfile() {
  const profile = useState<StyleProfile | null>('thread-profile', () => null)
  return { profile }
}
