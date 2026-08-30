import { rankProducts } from '~/domain/productSearch'
import type { Product, ProductSearchInput, ShoppingGender, StyleId } from '~/types/thread'
import type { ProductProvider } from './ProductProvider'

export class LocalProductProvider implements ProductProvider {
  constructor(private readonly products: readonly Product[]) {}

  async search(input: ProductSearchInput, userStyles: StyleId[], gender: ShoppingGender = 'all'): Promise<Product[]> {
    return rankProducts(this.products, input, userStyles, gender)
  }

  getById(id: string): Product | undefined {
    return this.products.find(product => product.id === id)
  }

  all(): readonly Product[] {
    return this.products
  }
}
