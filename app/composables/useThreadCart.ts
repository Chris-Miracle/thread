import type { CartState } from '~/types/thread'

export function useThreadCart() {
  const cart = useState<CartState>('thread-cart', () => ({ version: 2, items: [] }))
  return { cart }
}
