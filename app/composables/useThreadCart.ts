import { emptyCartState, type CartState } from '~/types/thread'

export function useThreadCart() {
  const cart = useState<CartState>('thread-cart', emptyCartState)
  return { cart }
}
