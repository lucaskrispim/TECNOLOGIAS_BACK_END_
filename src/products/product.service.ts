import type { Product } from '../generated/pg'
import { NotFoundError } from '../http/errors'
import type { ProductRepository } from './product.repository'
import type { ProductCreateInput, ProductUpdateInput } from './product.schema'

export interface ProductService {
  list(): Promise<Product[]>
  get(id: number): Promise<Product>
  create(input: ProductCreateInput): Promise<Product>
  update(id: number, patch: ProductUpdateInput): Promise<Product>
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

    async update(id, patch) {
      const atualizado = await repo.update(id, patch)
      if (atualizado === null) throw naoEncontrado(id)
      return atualizado
    },

    async remove(id) {
      const removido = await repo.remove(id)
      if (!removido) throw naoEncontrado(id)
    },
  }
}
