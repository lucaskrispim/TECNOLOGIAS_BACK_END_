import type { ProductCreateInput } from '../../src/products/product.schema'

export function productInput(over: Partial<ProductCreateInput> = {}): ProductCreateInput {
  return {
    title: 'Teclado mecanico ABNT2',
    description: 'Teclado com switch marrom e layout brasileiro.',
    price: '349.90',
    imageUrl: 'https://cdn.exemplo.com/produtos/teclado-abnt2.jpg',
    ...over,
  }
}
