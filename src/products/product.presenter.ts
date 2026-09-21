import type { Product } from '../generated/pg'

export interface ProductDto {
  id: number
  title: string
  description: string
  imageUrl: string
  price: string
  createdAt: string
  updatedAt: string
}

/**
 * Traduz o registro do banco para o contrato da API.
 *
 * O preco sai como string de duas casas por dois motivos. Numero de ponto
 * flutuante em JSON perderia precisao de centavo, e os dois bancos devolvem o
 * Decimal com escala diferente: o Postgres da 349.90 e o SQLite da 349.9. O
 * toFixed uniformiza a resposta.
 */
export function toApi(product: Product): ProductDto {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price.toFixed(2),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}
