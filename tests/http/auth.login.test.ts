import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { testTokens, usuarioAutenticado } from '../support/auth'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb } from '../support/db'

const app = makeTestApp()

beforeEach(resetDb)
afterAll(disconnectDb)

describe('POST /api/auth/login', () => {
  it('autentica e devolve 200 com usuario e token', async () => {
    const { user, password } = await usuarioAutenticado()

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email, name: user.name })
    expect(testTokens.verify(res.body.token)).toEqual({ userId: user.id })
  })

  it('aceita o e-mail em outra caixa e com espacos', async () => {
    const { user, password } = await usuarioAutenticado({ email: 'carla@exemplo.com' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  CARLA@exemplo.com ', password })

    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(user.id)
  })

  it('devolve 401 para senha errada', async () => {
    const { user } = await usuarioAutenticado()

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senha-errada' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('unauthorized')
    expect(res.body.token).toBeUndefined()
  })

  it('devolve 401 para e-mail que nao existe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: 'qualquer-senha' })

    expect(res.status).toBe(401)
  })

  it('a senha diferencia maiuscula de minuscula', async () => {
    const { user } = await usuarioAutenticado({ password: 'SenhaForte' })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senhaforte' })

    expect(res.status).toBe(401)
  })

  it('devolve 400, e nao 401, para pedido malformado', async () => {
    const semSenha = await request(app).post('/api/auth/login').send({ email: 'a@b.com' })
    const emailInvalido = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-e-email', password: 'x' })

    expect(semSenha.status).toBe(400)
    expect(emailInvalido.status).toBe(400)
  })

  it('o 401 traz o cabecalho WWW-Authenticate', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: 'x' })

    expect(res.headers['www-authenticate']).toMatch(/^Bearer/)
  })
})
