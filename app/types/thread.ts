export const STYLE_OPTIONS = [
  { id: 'minimal', label: 'Minimal', description: 'Clean lines, quiet palettes' },
  { id: 'streetwear', label: 'Streetwear', description: 'Relaxed shapes, bold proportions' },
  { id: 'smart-casual', label: 'Smart Casual', description: 'Polished, never overdressed' },
  { id: 'classic', label: 'Classic', description: 'Timeless wardrobe foundations' },
  { id: 'old-money', label: 'Old Money', description: 'Heritage texture, easy elegance' },
  { id: 'sporty', label: 'Sporty', description: 'Technical comfort, athletic energy' },
  { id: 'y2k', label: 'Y2K', description: 'Playful turn-of-the-century edge' },
  { id: 'avant-garde', label: 'Avant-Garde', description: 'Sculptural, directional pieces' },
] as const

export const SHOPPING_GENDERS = [
  { id: 'women', label: 'Women', description: "Prioritize women's departments" },
  { id: 'men', label: 'Men', description: "Prioritize men's departments" },
  { id: 'all', label: 'Everyone', description: 'Search every department' },
] as const

export const PRODUCT_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'activewear'] as const
export const OCCASIONS = ['dinner', 'date-night', 'work', 'casual', 'weekend', 'party', 'formal', 'travel', 'training'] as const
export const PRODUCT_AVAILABILITY = ['in-stock', 'limited', 'out-of-stock', 'unknown'] as const

export type StyleId = typeof STYLE_OPTIONS[number]['id']
export type ShoppingGender = typeof SHOPPING_GENDERS[number]['id']
export type ProductCategory = typeof PRODUCT_CATEGORIES[number]
export type Occasion = typeof OCCASIONS[number]
export type ProductAvailability = typeof PRODUCT_AVAILABILITY[number]
export type ProductSource = 'curated' | 'agent'
export type ActionSource = 'human' | 'agent' | 'debug'
export type ProductSort = 'recommended' | 'price-asc' | 'price-desc'
export type ResearchDepth = 'focused' | 'balanced' | 'deep'
export type ResearchTargetStatus = 'queued' | 'exploring' | 'complete' | 'no-results' | 'error'

export interface ResultFilters {
  retailer: string
  brand: string
  category: ProductCategory | ''
  maxPrice?: number
  sort: ProductSort
}

export interface StyleProfile {
  version: 2
  name: string
  gender: ShoppingGender
  styles: StyleId[]
}

export interface Retailer {
  id: string
  name: string
  domain: string
  logo: string
  searchUrl: string
  departments: ShoppingGender[]
  tags: string[]
}

export interface ResearchTarget {
  id: string
  retailerId: string
  name: string
  logo: string
  url: string
  sourceType: 'retailer' | 'discovery'
  status: ResearchTargetStatus
  productCount: number
  note: string
  updatedAt: string | null
}

export interface Product {
  id: string
  name: string
  brand: string
  retailer: string
  retailerId: string
  retailerLogo: string
  category: ProductCategory
  gender: ShoppingGender
  price: number
  currency: string
  image: string
  url: string
  colors: string[]
  sizes: string[]
  styleTags: StyleId[]
  occasionTags: Occasion[]
  description: string
  source: ProductSource
  availability: ProductAvailability
  observedAt: string
}

export interface ProductSearchInput {
  query: string
  occasion?: Occasion
  category?: ProductCategory
  maxPrice?: number
  retailerIds?: string[]
}

export interface AgentProductInput {
  name: string
  brand: string
  retailer: string
  category: ProductCategory
  gender?: ShoppingGender
  price: number
  currency: string
  image: string
  url: string
  colors: string[]
  sizes: string[]
  styleTags?: StyleId[]
  occasionTags?: Occasion[]
  description: string
  availability?: ProductAvailability
  observedAt: string
}

export interface CartItem {
  id: string
  productId: string
  product: Product
  size?: string
  color?: string
  addedAt: string
}

export interface CartState {
  version: 2
  items: CartItem[]
}

export interface CartTotal {
  currency: string
  subtotal: number
}

export interface CartSummary {
  items: CartItem[]
  itemCount: number
  totals: CartTotal[]
}

export interface SearchLane {
  searchId: string | null
  query: string
  input: ProductSearchInput | null
  results: Product[]
  status: 'idle' | 'loading' | 'exploring' | 'success' | 'error'
  hasSearched: boolean
  error: string | null
  startedAt: string | null
  updatedAt: string | null
  exploredRetailers: string[]
  researchDepth: ResearchDepth
  researchTargets: ResearchTarget[]
}

export interface SearchState {
  results: SearchLane
}

export interface AgentProductState {
  version: 1
  products: Product[]
}

export interface ThreadToastMessage {
  id: number
  message: string
}

export interface WebMCPStatusState {
  supported: boolean
  registered: boolean
  toolNames: string[]
  error: string | null
}

export interface AddToCartResult {
  success: true
  duplicate: boolean
  item: CartItem
  cartCount: number
  totals: CartTotal[]
}

export interface PublishProductsResult {
  searchId: string
  accepted: Product[]
  rejected: Array<{ index: number; reason: string }>
  visibleCount: number
}

export function emptySearchLane(): SearchLane {
  return {
    searchId: null,
    query: '',
    input: null,
    results: [],
    status: 'idle',
    hasSearched: false,
    error: null,
    startedAt: null,
    updatedAt: null,
    exploredRetailers: [],
    researchDepth: 'deep',
    researchTargets: [],
  }
}

export function emptyResultFilters(): ResultFilters {
  return { retailer: '', brand: '', category: '', maxPrice: undefined, sort: 'recommended' }
}
