export const STYLE_OPTIONS = [
  { id: 'minimal', label: 'Minimal', description: 'Clean lines, quiet palettes' },
  { id: 'streetwear', label: 'Streetwear', description: 'Relaxed shapes, bold proportions' },
  { id: 'smart-casual', label: 'Smart Casual', description: 'Polished, never overdressed' },
  { id: 'classic', label: 'Classic', description: 'Timeless wardrobe foundations' },
  { id: 'old-money', label: 'Old Money', description: 'Heritage texture, easy elegance' },
  { id: 'sporty', label: 'Sporty', description: 'Technical comfort, athletic energy' },
  { id: 'y2k', label: 'Y2K', description: 'Playful turn-of-the-century edge' },
  { id: 'avant-garde', label: 'Avant-Garde', description: 'Sculptural, directional pieces' },
  { id: 'quiet-luxury', label: 'Quiet Luxury', description: 'Refined fabrics, discreet polish' },
  { id: 'athleisure', label: 'Athleisure', description: 'Performance ease for everyday wear' },
  { id: 'preppy', label: 'Preppy', description: 'Collegiate classics, crisp layers' },
  { id: 'vintage', label: 'Vintage', description: 'Character-rich pieces from past eras' },
  { id: 'monochrome', label: 'Monochrome', description: 'One-colour dressing with tonal depth' },
  { id: 'techwear', label: 'Techwear', description: 'Utility details, technical fabrics' },
  { id: 'boho', label: 'Boho', description: 'Relaxed texture, expressive layering' },
] as const

export const MIN_PROFILE_STYLES = 3
export const MAX_PROFILE_STYLES = 10

export const SHOPPING_DEPARTMENTS = [
  { id: 'women', label: 'Women', description: "Prioritize women's departments" },
  { id: 'men', label: 'Men', description: "Prioritize men's departments" },
  { id: 'all', label: 'Everyone', description: 'Search every department' },
] as const

// Kept as a source-compatible export for the existing onboarding fixture data.
export const SHOPPING_GENDERS = SHOPPING_DEPARTMENTS

export const PRODUCT_CATEGORIES = [
  'tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'activewear', 'swimwear', 'fragrance',
] as const
export const OCCASIONS = [
  'dinner', 'date-night', 'work', 'casual', 'weekend', 'party', 'formal', 'travel', 'training', 'vacation', 'beach', 'resort',
] as const
export const PRODUCT_AVAILABILITY = ['in-stock', 'limited', 'out-of-stock', 'unknown'] as const
export const RESEARCH_TARGET_STATUSES = ['queued', 'claimed', 'exploring', 'complete', 'no-results', 'failed', 'cancelled', 'skipped'] as const
export const SEARCH_STATUSES = ['active', 'satisfied', 'completed', 'cancelled', 'abandoned', 'failed'] as const
export const RECOMMENDATION_REVIEW_STATUSES = ['pending', 'accepted', 'replacement-started'] as const
export const PRICE_TIERS = ['value', 'mid', 'premium', 'luxury'] as const
export const RETAILER_TYPES = ['brand', 'department', 'marketplace', 'specialist'] as const

export type StyleId = typeof STYLE_OPTIONS[number]['id']
export type ShoppingDepartment = typeof SHOPPING_DEPARTMENTS[number]['id']
export type ShoppingGender = ShoppingDepartment
export type ProductCategory = typeof PRODUCT_CATEGORIES[number]
export type Occasion = typeof OCCASIONS[number]
export type ProductAvailability = typeof PRODUCT_AVAILABILITY[number]
export type ResearchTargetStatus = typeof RESEARCH_TARGET_STATUSES[number]
export type SearchStatus = typeof SEARCH_STATUSES[number]
export type RecommendationReviewStatus = typeof RECOMMENDATION_REVIEW_STATUSES[number]
export type PriceTier = typeof PRICE_TIERS[number]
export type RetailerType = typeof RETAILER_TYPES[number]
export type ProductSource = 'agent' | 'curated-fixture'
export type ProductStage = 'candidate' | 'enriched'
export type ActionSource = 'human' | 'agent' | 'debug'
export type ProductSort = 'recommended' | 'price-asc' | 'price-desc' | 'newest'
export type CurrencyCode = 'CAD' | string

export interface ResultFilters {
  retailer: string
  brand: string
  category: ProductCategory | ''
  maxPriceCad?: number
  sort: ProductSort
}

export interface ClothingSizes {
  tops?: string
  bottoms?: string
  dresses?: string
  outerwear?: string
}

export interface StyleProfile {
  version: 4
  name: string
  shoppingDepartment: ShoppingDepartment
  styles: StyleId[]
  genderIdentity?: string
  racialIdentity?: string
  heightCm?: number
  weightKg?: number
  clothingSizes?: ClothingSizes
  shoeSize?: string
  preferredFit?: string
  preferredColours?: string[]
  avoidedColours?: string[]
  usualBudgetCad?: number
  preferredRetailerIds?: string[]
  excludedRetailerIds?: string[]
}

export interface RetailerCapabilities {
  categories: ProductCategory[]
  styles: StyleId[]
  occasions: Occasion[]
  priceTier: PriceTier
  retailerType: RetailerType
}

export interface RetailerAdapter {
  id: string
  name: string
  domains: string[]
  logo: string
  departments: ShoppingDepartment[]
  tags: string[]
  aliases: string[]
  capabilities: RetailerCapabilities
  searchTemplate: string
}

export interface MissionContext {
  tripType?: string
  destination?: string
  climateHints: string[]
  occasions: Occasion[]
  notes?: string
}

export interface MissionNeed {
  id: string
  intent: string
  queries: string[]
  categories: ProductCategory[]
  required: boolean
  quantity: number
  budgetCad?: number
}

export interface MissionConstraints {
  maxPriceCad?: number
  overallBudgetCad?: number
  categories: ProductCategory[]
  retailerIds: string[]
  excludedRetailerIds: string[]
}

export interface SearchMission {
  version: 1
  rawPrompt: string
  shoppingDepartment: ShoppingDepartment
  stylePreferences: StyleId[]
  context: MissionContext
  needs: MissionNeed[]
  constraints: MissionConstraints
  derivedQueries: string[]
  createdAt: string
}

export interface SearchMissionInput {
  rawPrompt: string
  shoppingDepartment?: ShoppingDepartment
  stylePreferences?: StyleId[]
  context?: Partial<MissionContext>
  needs?: Array<{
    intent: string
    queries: string[]
    categories?: ProductCategory[]
    required?: boolean
    quantity?: number
    budgetCad?: number
  }>
  constraints?: Partial<MissionConstraints>
}

export interface ResearchTarget {
  id: string
  retailerId: string
  name: string
  logo: string
  sourceType: 'retailer' | 'discovery'
  status: ResearchTargetStatus
  relevanceScore: number
  priorityScore: number
  priorityReasons: string[]
  rank: number
  needIds: string[]
  queries: string[]
  searchUrls: string[]
  productCount: number
  rejectedCount: number
  note: string
  claimId: string | null
  claimedBy: string | null
  claimedAt: string | null
  updatedAt: string | null
}

export interface Product {
  id: string
  searchId: string
  targetId: string
  needIds: string[]
  name: string
  brand?: string
  retailer: string
  retailerId: string
  retailerLogo: string
  category?: ProductCategory
  shoppingDepartment?: ShoppingDepartment
  nativePrice?: number
  nativeCurrency?: CurrencyCode
  priceCad?: number
  image?: string
  imageWidth?: number
  imageHeight?: number
  url: string
  colors: string[]
  sizes: string[]
  styleTags: StyleId[]
  occasionTags: Occasion[]
  description?: string
  material?: string
  source: ProductSource
  stage: ProductStage
  availability: ProductAvailability
  observedAt: string
  relevanceScore: number
}

export interface ProductCandidateInput {
  url: string
  name: string
  image: string
  retailer?: string
  brand?: string
  nativePrice?: number
  nativeCurrency?: string
  priceCad?: number
  imageWidth?: number
  imageHeight?: number
  category?: ProductCategory
  shoppingDepartment?: ShoppingDepartment
  needIds?: string[]
}

/** Development-only input for the curated fixture provider. Not exposed through WebMCP. */
export interface ProductSearchInput {
  query: string
  occasion?: Occasion
  category?: ProductCategory
  maxPriceCad?: number
  retailerIds?: string[]
}

export interface ProductEnrichmentInput {
  productId: string
  name?: string
  brand?: string
  nativePrice?: number
  nativeCurrency?: string
  priceCad?: number
  image?: string
  imageWidth?: number
  imageHeight?: number
  category?: ProductCategory
  shoppingDepartment?: ShoppingDepartment
  colors?: string[]
  sizes?: string[]
  styleTags?: StyleId[]
  occasionTags?: Occasion[]
  description?: string
  material?: string
  availability?: ProductAvailability
}

export interface RankingTrace {
  productId: string
  relevanceScore: number
  diversityAdjustment: number
  finalScore: number
  position: number
}

export interface ExecutionTraceEvent {
  id: string
  type:
    | 'search_started'
    | 'mission_created'
    | 'targets_ranked'
    | 'targets_claimed'
    | 'target_started'
    | 'candidate_received'
    | 'candidate_accepted'
    | 'candidate_rejected'
    | 'product_enriched'
    | 'target_completed'
    | 'target_failed'
    | 'search_completed'
    | 'search_satisfied'
    | 'search_cancelled'
  at: string
  targetId?: string
  productId?: string
  message: string
  details?: Record<string, string | number | boolean>
}

export interface NeedFulfillment {
  needId: string
  intent: string
  required: boolean
  requiredQuantity: number
  matchedProductIds: string[]
  selectedProductIds: string[]
  subtotalCad: number
  budgetCad?: number
  satisfied: boolean
}

export interface SearchFulfillment {
  needs: NeedFulfillment[]
  selectedProductIds: string[]
  subtotalCad: number
  overallBudgetCad?: number
  satisfied: boolean
}

export type RecommendationReviewResolution =
  | 'user-accepted'
  | 'timeout-accepted'
  | 'replace-selected'
  | 'replace-all'

export interface RecommendationReview {
  status: RecommendationReviewStatus
  productIds: string[]
  likedProductIds: string[]
  rejectedProductIds: string[]
  startedAt: string
  deadlineAt: string
  completedAt: string | null
  resolution: RecommendationReviewResolution | null
  replacementSearchId: string | null
}

export interface ReplacementContext {
  rootSearchId: string
  rootPrompt: string
  sourceSearchId: string
  preservedProducts: Product[]
  replacedProductIds: string[]
}

export interface SearchSession {
  version: 1
  id: string
  status: SearchStatus
  mission: SearchMission
  targets: ResearchTarget[]
  products: Product[]
  rankings: RankingTrace[]
  fulfillment: SearchFulfillment
  acceptedCandidateCount: number
  rejectedCandidateCount: number
  telemetry: ExecutionTraceEvent[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
  cancellationReason: string | null
  revision: number
  recommendationReview?: RecommendationReview
  replacementContext?: ReplacementContext
}

export interface SearchState {
  version: 4
  activeSearch: SearchSession | null
  recentSearches: SearchSession[]
}

export interface SavedResearchEntry {
  id: string
  searchId: string
  prompt: string
  acceptedAt: string
  resolution: RecommendationReviewResolution
  products: Product[]
}

export interface ResearchHistoryState {
  version: 1
  entries: SavedResearchEntry[]
  seenProductKeys: string[]
}

export interface SearchCoverage {
  eligibleRetailers: number
  totalTargets: number
  queuedTargets: number
  claimedTargets: number
  activeTargets: number
  completedTargets: number
  noResultTargets: number
  failedTargets: number
  cancelledTargets: number
  skippedTargets: number
  acceptedCandidateCount: number
  rejectedCandidateCount: number
  unresolvedTargets: number
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
  version: 3
  items: CartItem[]
}

export interface CartTotal {
  currency: 'CAD'
  subtotal: number
}

export interface CartSummary {
  items: CartItem[]
  itemCount: number
  totals: CartTotal[]
  unpricedItemCount: number
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

export interface PublishCandidatesResult {
  searchId: string
  accepted: Product[]
  rejected: Array<{ index: number; reason: string }>
  coverage: SearchCoverage
  nextAction: 'publish_candidates' | 'complete_search_target' | 'claim_search_targets'
}

export interface GetProductsInput {
  searchId?: string
  cursor?: string
  offset?: number
  limit?: number
  retailerId?: string
  category?: ProductCategory
  sort?: ProductSort
}

export function emptySearchState(): SearchState {
  return { version: 4, activeSearch: null, recentSearches: [] }
}

export function emptyResultFilters(): ResultFilters {
  return { retailer: '', brand: '', category: '', maxPriceCad: undefined, sort: 'recommended' }
}

export function emptyResearchHistory(): ResearchHistoryState {
  return { version: 1, entries: [], seenProductKeys: [] }
}
