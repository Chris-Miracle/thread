export const PROFILE_STORAGE_KEY = 'thread.profile.v1'
export const CART_STORAGE_KEY = 'thread.cart.v1'
export const AGENT_PRODUCTS_STORAGE_KEY = 'thread.products.agent.v1'

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
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
