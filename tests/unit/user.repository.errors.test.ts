import { describe, expect, it } from 'vitest'

import type { Db } from '../../src/db/client'
import { ConflictError } from '../../src/http/errors'
import { createUserRepository } from '../../src/users/user.repository'

function dbQueEstoura(erro: unknown): Db {
  return {
    user: {
      create: async () => {
        throw erro
      },
    },
  } as unknown as Db
}

const entrada = { name: 'Maria', email: 'maria@exemplo.com', passwordHash: 'h' }

describe('repositorio de usuario diante de erro do Prisma', () => {
  it('traduz P2002, violacao de unicidade, em 409', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    const repo = createUserRepository(dbQueEstoura(p2002))

    const erro = await repo.create(entrada).catch((e) => e)

    expect(erro).toBeInstanceOf(ConflictError)
    expect(erro.status).toBe(409)
  })

  it('propaga erro de outro codigo, para virar 500', async () => {
    const p1001 = Object.assign(new Error('banco inalcancavel'), { code: 'P1001' })

    await expect(createUserRepository(dbQueEstoura(p1001)).create(entrada)).rejects.toBe(p1001)
  })

  it('propaga erro sem codigo', async () => {
    const semCodigo = new Error('socket hang up')

    await expect(createUserRepository(dbQueEstoura(semCodigo)).create(entrada)).rejects.toBe(
      semCodigo,
    )
  })
})
