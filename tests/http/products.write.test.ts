import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { createProductRepository } from '../../src/products/product.repository'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb, testDb } from '../support/db'
import { productInput } from '../support/factories'

const app = makeTestApp()
const repo = createProductRepository(testDb)

beforeEach(resetDb)
afterAll(disconnectDb)

describe('POST /products', () => {
  it('cria o registro, devolve 201, o corpo criado e o cabecalho Location', async () => {
    const res = await request(app).post('/products').send(productInput({ price: '19.9' }))

    expect(res.status).toBe(201)
    expect(res.body.id).toBeGreaterThan(0)
    expect(res.body.price).toBe('19.90')
    expect(res.headers.location).toBe(`/products/${res.body.id}`)
  })

  it('persiste de verdade, e a leitura seguinte encontra o registro', async () => {
    const criado = await request(app).post('/products').send(productInput())
    const lido = await request(app).get(`/products/${criado.body.id}`)

    expect(lido.status).toBe(200)
    expect(lido.body).toEqual(criado.body)
  })

  it('devolve 400 com a lista de campos invalidos', async () => {
    const res = await request(app).post('/products').send({ title: '', price: 'x' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'description',
      'price',
      'title',
    ])
  })

  it('devolve 400 quando o corpo nao chega como JSON', async () => {
    const res = await request(app)
      .post('/products')
      .set('content-type', 'text/plain')
      .send('title=Teclado')

    expect(res.status).toBe(400)
  })

  it('ignora id enviado no corpo, o banco decide o id', async () => {
    const res = await request(app).post('/products').send({ ...productInput(), id: 4242 })

    expect(res.status).toBe(201)
    expect(res.body.id).not.toBe(4242)
  })
})

describe('PUT /products/:id', () => {
  it('atualiza e devolve 200 com o registro novo', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app)
      .put(`/products/${criado.id}`)
      .send(productInput({ title: 'Teclado sem fio', price: '499.00' }))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: criado.id,
      title: 'Teclado sem fio',
      price: '499.00',
    })
  })

  it('devolve 404 para id inexistente', async () => {
    const res = await request(app).put('/products/999999').send(productInput())

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })

  it('valida o corpo antes de tocar no banco', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app).put(`/products/${criado.id}`).send({ title: 'so o titulo' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect((await repo.findById(criado.id))?.title).toBe(criado.title)
  })
})

describe('DELETE /products/:id', () => {
  it('remove e devolve 204 sem corpo', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app).delete(`/products/${criado.id}`)

    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
    expect(res.text).toBe('')
    expect(await repo.findById(criado.id)).toBeNull()
  })

  it('devolve 404 para id inexistente', async () => {
    const res = await request(app).delete('/products/999999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })

  it('na segunda chamada do mesmo id devolve 404', async () => {
    const criado = await repo.create(productInput())

    expect((await request(app).delete(`/products/${criado.id}`)).status).toBe(204)
    expect((await request(app).delete(`/products/${criado.id}`)).status).toBe(404)
  })
})
