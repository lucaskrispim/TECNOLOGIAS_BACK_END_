import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ConflictError } from '../../src/http/errors'
import { createUserRepository } from '../../src/users/user.repository'
import { disconnectDb, resetDb, testDb } from '../support/db'

const repo = createUserRepository(testDb)
const entrada = { name: 'Maria Souza', email: 'maria@exemplo.com', passwordHash: '$2b$04$hash' }

beforeEach(resetDb)
afterAll(disconnectDb)

describe('repositorio de usuario no banco', () => {
  it('cria com id, timestamps e o hash informado', async () => {
    const criado = await repo.create(entrada)

    expect(criado.id).toBeGreaterThan(0)
    expect(criado.passwordHash).toBe('$2b$04$hash')
    expect(criado.createdAt).toBeInstanceOf(Date)
    expect(criado.updatedAt).toBeInstanceOf(Date)
  })

  it('busca por e-mail e por id', async () => {
    const criado = await repo.create(entrada)

    expect((await repo.findByEmail('maria@exemplo.com'))?.id).toBe(criado.id)
    expect((await repo.findById(criado.id))?.email).toBe('maria@exemplo.com')
  })

  it('devolve null para e-mail e id que nao existem', async () => {
    expect(await repo.findByEmail('ninguem@exemplo.com')).toBeNull()
    expect(await repo.findById(999999)).toBeNull()
  })

  it('o indice unico do banco barra e-mail repetido com 409', async () => {
    await repo.create(entrada)

    await expect(repo.create({ ...entrada, name: 'Outra Maria' })).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('cadastros concorrentes do mesmo e-mail gravam um so registro', async () => {
    const resultados = await Promise.allSettled([repo.create(entrada), repo.create(entrada)])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await testDb.user.count()).toBe(1)
  })
})
