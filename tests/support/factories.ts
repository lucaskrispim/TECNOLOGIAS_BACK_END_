import type { RegisterInput } from '../../src/auth/auth.schema'
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

let sequencia = 0

/** E-mail diferente a cada chamada, para que dois usuarios nao colidam. */
export function userInput(over: Partial<RegisterInput> = {}): RegisterInput {
  sequencia += 1
  return {
    name: 'Maria Souza',
    email: `maria.${sequencia}@exemplo.com`,
    password: 'senha-forte-123',
    ...over,
  }
}
