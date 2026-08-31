import { PRODUCTS } from '~/data/products'
import { createThreadActions } from '~/domain/threadActions'
import { getBrowserStorage } from '~/utils/storage'

export function useThreadActions() {
  const { profile } = useThreadProfile()
  const { cart } = useThreadCart()
  const { search } = useThreadSearch()
  const { showToast } = useThreadToast()
  const hydrated = useState<boolean>('thread-hydrated', () => false)

  return createThreadActions({
    profile,
    cart,
    search,
    hydrated,
    storage: getBrowserStorage(),
    fixtures: PRODUCTS,
    notify: showToast,
  })
}
