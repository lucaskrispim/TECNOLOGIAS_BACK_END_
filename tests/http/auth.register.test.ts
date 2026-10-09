import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { testTokens } from '../support/auth'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb, testDb } from '../support/db'
import { userInput } from '../support/factories'

const app = makeTestApp()

function campos(body: { details?: { field: string }[] }): string[] {
  return (body.details ?? []).map((d) => d.field).sort()
}

beforeEach(resetDb)
afterAll(disconnectDb)

describe('POST /api/auth/register', () => {
  it('cria o usuario e devolve 201 com usuario e token', async () => {
    const entrada = userInput()

    const res = await request(app).post('/api/auth/register').send(entrada)

    expect(res.status).toBe(201)
    expect(res.body.user).toEqual({
      id: expect.any(Number),
      name: entrada.name,
      email: entrada.email,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(testTokens.verify(res.body.token)).toEqual({ userId: res.body.user.id })
  })

  it('aponta Location para o recurso do usuario autenticado', async () => {
    const res = await request(app).post('/api/auth/register').send(userInput())

    expect(res.headers.location).toBe('/api/auth/me')
  })

  it('grava o e-mail normalizado em minusculas', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(userInput({ email: '  Joao.Silva@Exemplo.COM ' }))

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('joao.silva@exemplo.com')
  })

  it('devolve 409 para e-mail ja cadastrado', async () => {
    const entrada = userInput()
    await request(app).post('/api/auth/register').send(entrada)

    const res = await request(app).post('/api/auth/register').send(entrada)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('conflict')
    expect(await testDb.user.count()).toBe(1)
  })

  it('o 409 vale tambem quando o e-mail repetido muda so a caixa', async () => {
    await request(app).post('/api/auth/register').send(userInput({ email: 'ana@exemplo.com' }))

    const res = await request(app)
      .post('/api/auth/register')
      .send(userInput({ email: 'ANA@Exemplo.com' }))

    expect(res.status).toBe(409)
  })

  it('devolve 400 para e-mail invalido', async () => {
    const res = await request(app).post('/api/auth/register').send(userInput({ email: 'ana@' }))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('validation_error')
    expect(campos(res.body)).toEqual(['email'])
  })

  it('devolve 400 para senha de 5 caracteres e aceita a de 6', async () => {
    const curta = await request(app).post('/api/auth/register').send(userInput({ password: '12345' }))
    const minima = await request(app).post('/api/auth/register').send(userInput({ password: '123456' }))

    expect(curta.status).toBe(400)
    expect(campos(curta.body)).toEqual(['password'])
    expect(minima.status).toBe(201)
  })

  it('devolve 400 acusando todos os campos ausentes', async () => {
    const res = await request(app).post('/api/auth/register').send({})

    expect(res.status).toBe(400)
    expect(campos(res.body)).toEqual(['email', 'name', 'password'])
  })

  it('devolve 400 para corpo que nao e JSON', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('content-type', 'application/json')
      .send('{"email": ')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('bad_request')
  })

  it('nao grava nada quando a validacao falha', async () => {
    await request(app).post('/api/auth/register').send(userInput({ password: '1' }))

    expect(await testDb.user.count()).toBe(0)
  })
})
