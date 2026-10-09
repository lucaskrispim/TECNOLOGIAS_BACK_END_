import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { ALLOWED_HEADERS } from '../../src/http/cors'
import { usuarioAutenticado } from '../support/auth'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb } from '../support/db'
import { productInput, userInput } from '../support/factories'

/**
 * Comportamento que existia antes da autenticacao e precisa continuar igual.
 * Cada caso aqui ja quebrou, ou quebraria, numa mudanca descuidada do app.
 */
const app = makeTestApp()

beforeEach(resetDb)
afterAll(disconnectDb)

describe('o que a tarefa 2 entregava continua valendo', () => {
  it('GET / continua devolvendo o status, sem exigir token', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('rota inexistente continua dando 404 em JSON, inclusive sob /api/auth', async () => {
    for (const caminho of ['/nao-existe', '/api/auth', '/api/auth/logout']) {
      const res = await request(app).get(caminho)
      expect(res.status, caminho).toBe(404)
      expect(res.body.error, caminho).toBe('not_found')
    }
  })

  it('verbo errado numa rota de auth continua dando 404, nao 500', async () => {
    expect((await request(app).get('/api/auth/login')).status).toBe(404)
    expect((await request(app).post('/api/auth/me')).status).toBe(404)
  })

  it('o CORS continua aceitando Content-Type e agora aceita Authorization', () => {
    const cabecalhos = ALLOWED_HEADERS.map((h) => h.toLowerCase())

    expect(cabecalhos).toContain('content-type')
    expect(cabecalhos).toContain('authorization')
  })

  it('o contrato de produto com token e o mesmo de antes: preco em string de duas casas', async () => {
    const { authorization } = await usuarioAutenticado()

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', authorization)
      .send(productInput({ price: 10 as unknown as string }))

    expect(res.status).toBe(201)
    expect(res.body.price).toBe('10.00')
    expect(Object.keys(res.body).sort()).toEqual(
      ['createdAt', 'description', 'id', 'imageUrl', 'price', 'title', 'updatedAt'],
    )
  })
})

describe('forma do erro igual em todos os status', () => {
  it('401 e 409 seguem o formato error, message e details', async () => {
    const entrada = userInput()
    await request(app).post('/api/auth/register').send(entrada)

    const respostas = [
      await request(app).get('/api/auth/me'),
      await request(app).post('/api/auth/register').send(entrada),
    ]

    expect(respostas.map((r) => r.status)).toEqual([401, 409])
    for (const res of respostas) {
      expect(Object.keys(res.body).every((k) => ['error', 'message', 'details'].includes(k))).toBe(
        true,
      )
      expect(typeof res.body.message).toBe('string')
      expect(res.headers['content-type']).toMatch(/application\/json/)
    }
  })
})

describe('corpo grande demais', () => {
  it('payload acima do limite do parser vira 413 em JSON, nao 500', async () => {
    const gigante = { name: 'x', email: 'a@b.com', password: 'p'.repeat(200 * 1024) }

    const res = await request(app).post('/api/auth/register').send(gigante)

    expect(res.status).toBe(413)
    expect(res.body.error).toBe('payload_too_large')
  })
})
