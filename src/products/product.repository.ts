import type { Product } from '../generated/pg'
import type { Db } from '../db/client'
import type { ProductCreateInput, ProductUpdateInput } from './product.schema'

export interface ProductRepository {
  create(input: ProductCreateInput): Promise<Product>
  findAll(): Promise<Product[]>
  findById(id: number): Promise<Product | null>
  /** Atualizacao parcial: coluna ausente do patch fica como esta. */
  update(id: number, patch: ProductUpdateInput): Promise<Product | null>
  remove(id: number): Promise<boolean>
}

/** Codigo do Prisma para operacao sobre registro que nao existe. */
const REGISTRO_NAO_ENCONTRADO = 'P2025'

export function createProductRepository(db: Db): ProductRepository {
  return {
    // O preco chega como string canonica de duas casas e o Prisma o converte
    // para Decimal, o que evita ponto flutuante no caminho do dinheiro.
    create: (input) => db.product.create({ data: input }),

    // Ordem estavel: o id desempata registros gravados no mesmo milissegundo.
    findAll: () => db.product.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),

    findById: (id) => db.product.findUnique({ where: { id } }),

    async update(id, patch) {
      try {
        return await db.product.update({ where: { id }, data: patch })
      } catch (erro) {
        if (naoEncontrado(erro)) return null
        throw erro
      }
    },

    async remove(id) {
      try {
        await db.product.delete({ where: { id } })
        return true
      } catch (erro) {
        if (naoEncontrado(erro)) return false
        throw erro
      }
    },
  }
}

/**
 * A checagem olha o campo `code` em vez de usar instanceof: cada schema do
 * Prisma gera o seu proprio runtime, e a classe de erro do client de SQLite
 * nao e a mesma do client de Postgres.
 */
function naoEncontrado(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code: unknown }).code === REGISTRO_NAO_ENCONTRADO
  )
}
