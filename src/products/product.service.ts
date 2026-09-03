import type { Product } from '../generated/pg'
import { NotFoundError } from '../http/errors'
import type { ProductRepository } from './product.repository'
import type { ProductInput } from './product.validation'

export interface ProductService {
  list(): Promise<Product[]>
  get(id: number): Promise<Product>
  create(input: ProductInput): Promise<Product>
  replace(id: number, input: ProductInput): Promise<Product>
  remove(id: number): Promise<void>
}

export function createProductService(repo: ProductRepository): ProductService {
  const naoEncontrado = (id: number) => new NotFoundError(`produto ${id} nao encontrado`)

  return {
    list: () => repo.findAll(),

    async get(id) {
      const produto = await repo.findById(id)
      if (produto === null) throw naoEncontrado(id)
      return produto
    },

    create: (input) => repo.create(input),

    async replace(id, input) {
      const atualizado = await repo.update(id, input)
      if (atualizado === null) throw naoEncontrado(id)
      return atualizado
    },

    async remove(id) {
      const removido = await repo.remove(id)
      if (!removido) throw naoEncontrado(id)
    },
  }
}
