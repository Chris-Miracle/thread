export const PROFILE_STORAGE_KEY = 'thread.profile.v4'
export const CART_STORAGE_KEY = 'thread.cart.v3'
export const SEARCH_STORAGE_KEY = 'thread.search.v4'
export const RESEARCH_HISTORY_STORAGE_KEY = 'thread.research-history.v1'
export const LEGACY_PROFILE_STORAGE_KEYS = ['thread.profile.v3', 'thread.profile.v1'] as const
export const LEGACY_CART_STORAGE_KEYS = ['thread.cart.v1'] as const
export const LEGACY_PRODUCT_STORAGE_KEYS = ['thread.products.agent.v1'] as const
export const LEGACY_SEARCH_STORAGE_KEYS = ['thread.search.v3'] as const

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function safeParse(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

const memory = new Map<string, string>()

const memoryStorage: StorageAdapter = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value) },
  removeItem: key => { memory.delete(key) },
}

export function getBrowserStorage(): StorageAdapter {
  return import.meta.client ? window.localStorage : memoryStorage
}
