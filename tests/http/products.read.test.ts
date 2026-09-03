import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { createProductRepository } from '../../src/products/product.repository'
import { makeTestApp } from '../support/app'
import { disconnectDb, esperar, resetDb, testDb } from '../support/db'
import { productInput } from '../support/factories'

const app = makeTestApp()
const repo = createProductRepository(testDb)

beforeEach(resetDb)
afterAll(disconnectDb)

describe('GET /products', () => {
  it('devolve lista vazia quando o banco esta vazio', async () => {
    const res = await request(app).get('/products')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('devolve os registros do mais recente para o mais antigo, com preco em string', async () => {
    await repo.create(productInput({ title: 'Primeiro', price: '10.00' }))
    await esperar(5)
    await repo.create(productInput({ title: 'Segundo', price: '349.90' }))

    const res = await request(app).get('/products')

    expect(res.status).toBe(200)
    expect(res.body.map((p: { title: string }) => p.title)).toEqual(['Segundo', 'Primeiro'])
    expect(res.body[0].price).toBe('349.90')
    expect(typeof res.body[0].id).toBe('number')
  })
})

describe('GET /products/:id', () => {
  it('devolve o registro pedido', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app).get(`/products/${criado.id}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(criado.id)
    expect(res.body.title).toBe(criado.title)
  })

  it('devolve 404 em JSON informativo para id inexistente', async () => {
    const res = await request(app).get('/products/999999')

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toMatchObject({ error: 'not_found' })
    expect(typeof res.body.message).toBe('string')
  })

  it('devolve 400 para id que nao e numero inteiro positivo', async () => {
    for (const id of ['abc', '1.5', '-3', '0', '  ']) {
      const res = await request(app).get(`/products/${encodeURIComponent(id)}`)
      expect(res.status, `id ${id}`).toBe(400)
      expect(res.body.error, `id ${id}`).toBe('bad_request')
    }
  })
})

describe('rota inexistente', () => {
  it('devolve 404 em JSON, nao o HTML padrao do Express', async () => {
    const res = await request(app).get('/nao-existe')

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toMatchObject({ error: 'not_found' })
  })
})
