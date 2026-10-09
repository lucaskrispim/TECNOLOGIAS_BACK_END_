import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { createProductRepository } from '../../src/products/product.repository'
import { bearer, usuarioAutenticado } from '../support/auth'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb, testDb } from '../support/db'
import { productInput } from '../support/factories'

const app = makeTestApp()
const repo = createProductRepository(testDb)

beforeEach(resetDb)
afterAll(disconnectDb)

/** As tres operacoes de escrita, para rodar a mesma verificacao em todas. */
async function escritas() {
  const existente = await repo.create(productInput())
  return [
    { nome: 'POST', req: () => request(app).post('/api/products').send(productInput()) },
    {
      nome: 'PUT',
      req: () => request(app).put(`/api/products/${existente.id}`).send({ title: 'Nome novo' }),
    },
    { nome: 'DELETE', req: () => request(app).delete(`/api/products/${existente.id}`) },
  ]
}

describe('escrita em products sem token', () => {
  it('POST, PUT e DELETE devolvem 401', async () => {
    for (const { nome, req } of await escritas()) {
      const res = await req()
      expect(res.status, nome).toBe(401)
      expect(res.body.error, nome).toBe('unauthorized')
    }
  })

  it('a falha nao altera o banco', async () => {
    const existente = await repo.create(productInput({ title: 'Original' }))

    await request(app).post('/api/products').send(productInput())
    await request(app).put(`/api/products/${existente.id}`).send({ title: 'Mudado' })
    await request(app).delete(`/api/products/${existente.id}`)

    expect(await testDb.product.count()).toBe(1)
    expect((await repo.findById(existente.id))?.title).toBe('Original')
  })

  it('autenticacao vem antes da validacao: corpo invalido sem token da 401, nao 400', async () => {
    const res = await request(app).post('/api/products').send({ title: '' })

    expect(res.status).toBe(401)
  })

  it('autenticacao vem antes do id: id invalido sem token da 401', async () => {
    const res = await request(app).delete('/api/products/abc')

    expect(res.status).toBe(401)
  })
})

describe('escrita em products com token invalido', () => {
  it('POST, PUT e DELETE devolvem 401', async () => {
    for (const { nome, req } of await escritas()) {
      const res = await req().set('Authorization', bearer('token.que.nao.vale'))
      expect(res.status, nome).toBe(401)
    }
  })
})

describe('escrita em products com token valido', () => {
  it('POST cria e devolve 201', async () => {
    const { authorization } = await usuarioAutenticado()

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', authorization)
      .send(productInput())

    expect(res.status).toBe(201)
  })

  it('PUT altera e devolve 200', async () => {
    const { authorization } = await usuarioAutenticado()
    const existente = await repo.create(productInput())

    const res = await request(app)
      .put(`/api/products/${existente.id}`)
      .set('Authorization', authorization)
      .send({ title: 'Nome novo' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Nome novo')
  })

  it('DELETE remove e devolve 204', async () => {
    const { authorization } = await usuarioAutenticado()
    const existente = await repo.create(productInput())

    const res = await request(app)
      .delete(`/api/products/${existente.id}`)
      .set('Authorization', authorization)

    expect(res.status).toBe(204)
    expect(await repo.findById(existente.id)).toBeNull()
  })

  it('com token valido, a validacao do corpo continua dando 400', async () => {
    const { authorization } = await usuarioAutenticado()

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', authorization)
      .send({ title: '' })

    expect(res.status).toBe(400)
  })
})

describe('leitura em products continua publica', () => {
  it('GET da lista e do item respondem 200 sem token', async () => {
    const existente = await repo.create(productInput())

    expect((await request(app).get('/api/products')).status).toBe(200)
    expect((await request(app).get(`/api/products/${existente.id}`)).status).toBe(200)
  })

  it('GET com token invalido tambem responde 200: rota publica ignora o cabecalho', async () => {
    const res = await request(app).get('/api/products').set('Authorization', bearer('lixo'))

    expect(res.status).toBe(200)
  })
})
