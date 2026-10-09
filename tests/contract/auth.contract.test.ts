import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { z } from 'zod'

import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb } from '../support/db'
import { userInput } from '../support/factories'

/**
 * O contrato que o front consome, escrito como schema. Se um campo mudar de
 * nome, de tipo ou aparecer um campo a mais, o teste quebra antes do front.
 */
const isoDate = z.iso.datetime()

const userDto = z.strictObject({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.email(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

const authResponse = z.strictObject({
  user: userDto,
  token: z.string().regex(/^[\w-]+\.[\w-]+\.[\w-]+$/),
})

const meResponse = z.strictObject({ user: userDto })

const errorResponse = z.strictObject({
  error: z.string(),
  message: z.string(),
  details: z.array(z.strictObject({ field: z.string(), message: z.string() })).optional(),
})

const app = makeTestApp()

beforeEach(resetDb)
afterAll(disconnectDb)

describe('contrato das respostas de auth', () => {
  it('register, login e me seguem o schema publicado', async () => {
    const entrada = userInput()

    const registro = await request(app).post('/api/auth/register').send(entrada)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: entrada.email, password: entrada.password })
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)

    expect(authResponse.safeParse(registro.body).error).toBeUndefined()
    expect(authResponse.safeParse(login.body).error).toBeUndefined()
    expect(meResponse.safeParse(me.body).error).toBeUndefined()
  })

  it('erros de auth seguem o schema de erro comum', async () => {
    const respostas = [
      await request(app).post('/api/auth/register').send({}),
      await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'z' }),
      await request(app).get('/api/auth/me'),
    ]

    for (const res of respostas) {
      expect(errorResponse.safeParse(res.body).error, String(res.status)).toBeUndefined()
    }
  })
})
