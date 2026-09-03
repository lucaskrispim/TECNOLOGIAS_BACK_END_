import { describe, expect, it } from 'vitest'

import type { Db } from '../../src/db/client'
import { createProductRepository } from '../../src/products/product.repository'
import { productInput } from '../support/factories'

/** Db falso que estoura o erro pedido em update e em delete. */
function dbQueEstoura(erro: unknown): Db {
  const falhar = async () => {
    throw erro
  }
  return { product: { update: falhar, delete: falhar } } as unknown as Db
}

const P2025 = Object.assign(new Error('registro nao existe'), { code: 'P2025' })
const P1001 = Object.assign(new Error('banco inalcancavel'), { code: 'P1001' })

describe('repositorio diante de erro do Prisma', () => {
  it('traduz P2025 em ausencia de registro', async () => {
    const repo = createProductRepository(dbQueEstoura(P2025))

    expect(await repo.update(1, productInput())).toBeNull()
    expect(await repo.remove(1)).toBe(false)
  })

  it('propaga erro que nao e de registro ausente, para virar 500', async () => {
    const repo = createProductRepository(dbQueEstoura(P1001))

    await expect(repo.update(1, productInput())).rejects.toBe(P1001)
    await expect(repo.remove(1)).rejects.toBe(P1001)
  })

  it('propaga erro sem codigo, como falha de rede', async () => {
    const semCodigo = new Error('socket hang up')
    const repo = createProductRepository(dbQueEstoura(semCodigo))

    await expect(repo.update(1, productInput())).rejects.toBe(semCodigo)
    await expect(repo.remove(1)).rejects.toBe(semCodigo)
  })
})
