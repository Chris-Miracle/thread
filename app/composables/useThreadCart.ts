import type { CartState } from '~/types/thread'

export function useThreadCart() {
  const cart = useState<CartState>('thread-cart', () => ({ version: 3, items: [] }))
  return { cart }
}
