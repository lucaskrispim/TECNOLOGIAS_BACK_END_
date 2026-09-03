import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createProductRepository } from '../../src/products/product.repository'
import { disconnectDb, esperar, resetDb, testDb } from '../support/db'
import { productInput } from '../support/factories'

const repo = createProductRepository(testDb)

beforeEach(resetDb)
afterAll(disconnectDb)

describe('create', () => {
  it('persiste e devolve o registro com id e timestamps', async () => {
    const criado = await repo.create(productInput())

    expect(criado.id).toBeGreaterThan(0)
    expect(criado.title).toBe('Teclado mecanico ABNT2')
    expect(criado.createdAt).toBeInstanceOf(Date)
    expect(criado.updatedAt).toBeInstanceOf(Date)
  })

  it('guarda o preco como decimal de duas casas', async () => {
    const criado = await repo.create(productInput({ price: '349.90' }))
    const lido = await repo.findById(criado.id)

    expect(criado.price.toFixed(2)).toBe('349.90')
    expect(lido?.price.toFixed(2)).toBe('349.90')
  })
})

describe('findAll', () => {
  it('devolve lista vazia quando nao ha registro', async () => {
    expect(await repo.findAll()).toEqual([])
  })

  it('devolve do mais recente para o mais antigo', async () => {
    const primeiro = await repo.create(productInput({ title: 'Primeiro' }))
    await esperar(5)
    const segundo = await repo.create(productInput({ title: 'Segundo' }))

    const lista = await repo.findAll()

    expect(lista.map((p) => p.id)).toEqual([segundo.id, primeiro.id])
  })
})

describe('findById', () => {
  it('devolve o registro existente', async () => {
    const criado = await repo.create(productInput())
    const lido = await repo.findById(criado.id)

    expect(lido?.id).toBe(criado.id)
    expect(lido?.title).toBe(criado.title)
  })

  it('devolve null para id inexistente', async () => {
    expect(await repo.findById(999_999)).toBeNull()
  })
})

describe('update', () => {
  it('altera os campos e move o updatedAt para frente', async () => {
    const criado = await repo.create(productInput())
    await esperar(10)

    const alterado = await repo.update(criado.id, productInput({ title: 'Novo titulo', price: '10.00' }))

    expect(alterado?.title).toBe('Novo titulo')
    expect(alterado?.price.toFixed(2)).toBe('10.00')
    expect(alterado!.updatedAt.getTime()).toBeGreaterThan(criado.updatedAt.getTime())
    expect(alterado!.createdAt.getTime()).toBe(criado.createdAt.getTime())
  })

  it('devolve null para id inexistente, em vez de estourar erro do Prisma', async () => {
    expect(await repo.update(999_999, productInput())).toBeNull()
  })
})

describe('remove', () => {
  it('remove o registro, e a leitura seguinte devolve null', async () => {
    const criado = await repo.create(productInput())

    expect(await repo.remove(criado.id)).toBe(true)
    expect(await repo.findById(criado.id)).toBeNull()
  })

  it('devolve false na segunda remocao do mesmo id', async () => {
    const criado = await repo.create(productInput())

    expect(await repo.remove(criado.id)).toBe(true)
    expect(await repo.remove(criado.id)).toBe(false)
  })
})
