import { PRODUCTS } from '~/data/products'
import { createThreadActions } from '~/domain/threadActions'
import { LocalProductProvider } from '~/providers/LocalProductProvider'
import { getBrowserStorage } from '~/utils/storage'

const provider = new LocalProductProvider(PRODUCTS)

export function useThreadActions() {
  const { profile } = useThreadProfile()
  const { cart } = useThreadCart()
  const { search } = useThreadSearch()
  const { agentProducts } = useThreadCatalog()
  const { showToast } = useThreadToast()
  const hydrated = useState<boolean>('thread-hydrated', () => false)

  return createThreadActions({
    profile,
    cart,
    search,
    agentProducts,
    hydrated,
    provider,
    storage: getBrowserStorage(),
    notify: showToast,
  })
}
