import type { ProductInput } from '../../src/products/product.validation'

export function productInput(over: Partial<ProductInput> = {}): ProductInput {
  return {
    title: 'Teclado mecanico ABNT2',
    description: 'Teclado com switch marrom e layout brasileiro.',
    price: '349.90',
    ...over,
  }
}
