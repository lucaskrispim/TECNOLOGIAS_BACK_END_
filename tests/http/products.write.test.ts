import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { createProductRepository } from '../../src/products/product.repository'
import { makeTestApp } from '../support/app'
import { disconnectDb, esperar, resetDb, testDb } from '../support/db'
import { productInput } from '../support/factories'

const app = makeTestApp()
const repo = createProductRepository(testDb)

/** Campos acusados no corpo de erro, ordenados para comparacao estavel. */
function camposInvalidos(body: { details?: { field: string }[] }): string[] {
  return (body.details ?? []).map((d) => d.field).sort()
}

beforeEach(resetDb)
afterAll(disconnectDb)

describe('POST /api/products', () => {
  it('cria o registro, devolve 201, o corpo criado e o cabecalho Location', async () => {
    const res = await request(app).post('/api/products').send(productInput({ price: '19.9' }))

    expect(res.status).toBe(201)
    expect(res.body.id).toBeGreaterThan(0)
    expect(res.body.price).toBe('19.90')
    expect(res.headers.location).toBe(`/api/products/${res.body.id}`)
  })

  it('persiste de verdade, e a leitura seguinte encontra o registro', async () => {
    const criado = await request(app).post('/api/products').send(productInput())
    const lido = await request(app).get(`/api/products/${criado.body.id}`)

    expect(lido.status).toBe(200)
    expect(lido.body).toEqual(criado.body)
  })

  it('devolve 400 com a lista de campos invalidos', async () => {
    const res = await request(app).post('/api/products').send({ title: '', price: 'x' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect(camposInvalidos(res.body)).toEqual(['description', 'imageUrl', 'price', 'title'])
  })

  it('cada detalhe do 400 traz campo e mensagem legivel', async () => {
    const res = await request(app).post('/api/products').send(productInput({ title: 'ab' }))

    expect(res.status).toBe(400)
    expect(res.body.details).toEqual([{ field: 'title', message: expect.stringMatching(/3/) }])
  })

  it('devolve 400 quando falta a imagem, exigida pelo front', async () => {
    const { imageUrl, ...semImagem } = productInput()

    const res = await request(app).post('/api/products').send(semImagem)

    expect(res.status).toBe(400)
    expect(camposInvalidos(res.body)).toEqual(['imageUrl'])
  })

  it('devolve 400 quando o corpo nao chega como JSON', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('content-type', 'text/plain')
      .send('title=Teclado')

    expect(res.status).toBe(400)
  })

  it('ignora id enviado no corpo, o banco decide o id', async () => {
    const res = await request(app).post('/api/products').send({ ...productInput(), id: 4242 })

    expect(res.status).toBe(201)
    expect(res.body.id).not.toBe(4242)
  })
})

describe('PUT /api/products/:id, atualizacao parcial', () => {
  it('altera so o campo enviado e preserva o resto', async () => {
    const criado = await repo.create(productInput())
    await esperar(5)

    const res = await request(app)
      .put(`/api/products/${criado.id}`)
      .send({ title: 'Teclado sem fio' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: criado.id,
      title: 'Teclado sem fio',
      description: criado.description,
      imageUrl: criado.imageUrl,
      price: criado.price.toFixed(2),
    })
    expect(res.body.createdAt).toBe(criado.createdAt.toISOString())
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(criado.updatedAt.getTime())
  })

  it('aceita o payload completo', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app)
      .put(`/api/products/${criado.id}`)
      .send(productInput({ title: 'Teclado sem fio', price: '499.00' }))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: criado.id, title: 'Teclado sem fio', price: '499.00' })
  })

  it('devolve 404 para id inexistente, traduzindo o P2025 do Prisma', async () => {
    const res = await request(app).put('/api/products/999999').send({ title: 'Nome novo' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })

  it('devolve 400 para id fora do formato', async () => {
    const res = await request(app).put('/api/products/abc').send({ title: 'Nome novo' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('bad_request')
  })

  it('devolve 400 para preco negativo, sem tocar no registro', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app).put(`/api/products/${criado.id}`).send({ price: '-10.00' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect(camposInvalidos(res.body)).toEqual(['price'])
    expect((await repo.findById(criado.id))?.price.toFixed(2)).toBe(criado.price.toFixed(2))
  })

  it('valida o corpo antes de tocar no banco', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app).put(`/api/products/${criado.id}`).send({ title: 'ab' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect((await repo.findById(criado.id))?.title).toBe(criado.title)
  })

  it('devolve 400 para corpo sem nenhum campo atualizavel', async () => {
    const criado = await repo.create(productInput())

    const vazio = await request(app).put(`/api/products/${criado.id}`).send({})
    const desconhecido = await request(app)
      .put(`/api/products/${criado.id}`)
      .send({ apelido: 'teclado' })

    expect(vazio.status).toBe(400)
    expect(desconhecido.status).toBe(400)
  })

  it('valida o corpo antes de ir atras de id inexistente', async () => {
    const res = await request(app).put('/api/products/999999').send({ title: 'ab' })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/products/:id', () => {
  it('remove e devolve 204 sem corpo', async () => {
    const criado = await repo.create(productInput())

    const res = await request(app).delete(`/api/products/${criado.id}`)

    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
    expect(res.text).toBe('')
    expect(await repo.findById(criado.id)).toBeNull()
  })

  it('devolve 404 para id inexistente', async () => {
    const res = await request(app).delete('/api/products/999999')

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
  })

  it('devolve 400 para id fora do formato', async () => {
    const res = await request(app).delete('/api/products/abc')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('bad_request')
  })

  it('na segunda chamada do mesmo id devolve 404', async () => {
    const criado = await repo.create(productInput())

    expect((await request(app).delete(`/api/products/${criado.id}`)).status).toBe(204)
    expect((await request(app).delete(`/api/products/${criado.id}`)).status).toBe(404)
  })
})
