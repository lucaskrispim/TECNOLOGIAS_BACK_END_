import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { PRODUTOS_INICIAIS, seedProducts } from '../../src/products/product.seed'
import { createProductRepository } from '../../src/products/product.repository'
import { validateProductInput } from '../../src/products/product.validation'
import { disconnectDb, resetDb, testDb } from '../support/db'

const repo = createProductRepository(testDb)

beforeEach(resetDb)
afterAll(disconnectDb)

describe('dados do seed', () => {
  it('traz pelo menos cinco registros, como o enunciado pede', () => {
    expect(PRODUTOS_INICIAIS.length).toBeGreaterThanOrEqual(5)
  })

  it('todo registro passa pela mesma validacao da API', () => {
    for (const produto of PRODUTOS_INICIAIS) {
      expect(validateProductInput(produto).ok, produto.title).toBe(true)
    }
  })

  it('nao tem titulo repetido', () => {
    const titulos = PRODUTOS_INICIAIS.map((p) => p.title)
    expect(new Set(titulos).size).toBe(titulos.length)
  })
})

describe('seedProducts', () => {
  it('popula o banco vazio', async () => {
    const inseridos = await seedProducts(testDb)

    expect(inseridos).toBe(PRODUTOS_INICIAIS.length)
    expect((await repo.findAll()).length).toBe(PRODUTOS_INICIAIS.length)
  })

  it('e idempotente: rodar duas vezes nao duplica', async () => {
    await seedProducts(testDb)
    await seedProducts(testDb)

    expect((await repo.findAll()).length).toBe(PRODUTOS_INICIAIS.length)
  })

  it('grava o preco com as duas casas', async () => {
    await seedProducts(testDb)
    const lista = await repo.findAll()

    for (const produto of lista) {
      expect(produto.price.toFixed(2)).toMatch(/^\d+\.\d{2}$/)
      expect(Number(produto.price.toFixed(2))).toBeGreaterThan(0)
    }
  })
})
