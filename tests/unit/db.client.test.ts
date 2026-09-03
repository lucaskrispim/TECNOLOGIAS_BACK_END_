import { afterEach, describe, expect, it } from 'vitest'

import { createDbClient, currentDriver } from '../../src/db/client'

const original = process.env.DB_DRIVER

afterEach(() => {
  if (original === undefined) delete process.env.DB_DRIVER
  else process.env.DB_DRIVER = original
})

describe('currentDriver', () => {
  it('usa postgresql por padrao', () => {
    delete process.env.DB_DRIVER
    expect(currentDriver()).toBe('postgresql')
  })

  it('usa sqlite quando DB_DRIVER pede', () => {
    process.env.DB_DRIVER = 'sqlite'
    expect(currentDriver()).toBe('sqlite')
  })

  it('trata valor desconhecido como postgresql', () => {
    process.env.DB_DRIVER = 'mysql'
    expect(currentDriver()).toBe('postgresql')
  })
})

describe('createDbClient', () => {
  // Construir o client nao abre conexao, entao os dois ramos podem ser
  // exercitados sem banco no ar e sem DATABASE_URL definida.
  it('devolve um client utilizavel nos dois providers', async () => {
    for (const driver of ['postgresql', 'sqlite'] as const) {
      const db = createDbClient(driver)

      expect(typeof db.product, driver).toBe('object')
      expect(typeof db.$disconnect, driver).toBe('function')

      await db.$disconnect()
    }
  })

  it('sem argumento, segue o DB_DRIVER do ambiente', async () => {
    process.env.DB_DRIVER = 'sqlite'
    const db = createDbClient()

    // O client de SQLite da suite consegue consultar de fato o banco de teste.
    await expect(db.product.count()).resolves.toBeGreaterThanOrEqual(0)
    await db.$disconnect()
  })
})
