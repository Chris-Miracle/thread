import type { Product, ProductSearchInput, ShoppingGender, StyleId } from '~/types/thread'

export interface ProductProvider {
  search(input: ProductSearchInput, userStyles: StyleId[], gender?: ShoppingGender): Promise<Product[]>
  getById(id: string): Product | undefined
  all(): readonly Product[]
}
