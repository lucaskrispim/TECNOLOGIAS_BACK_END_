import jwt from 'jsonwebtoken'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTokenService } from '../../src/auth/token'
import { TEST_SECRET, bearer, usuarioAutenticado } from '../support/auth'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb, testDb } from '../support/db'

const app = makeTestApp()

beforeEach(resetDb)
afterAll(disconnectDb)

describe('GET /api/auth/me', () => {
  it('com token valido devolve 200 e os dados do usuario', async () => {
    const { user, authorization } = await usuarioAutenticado()

    const res = await request(app).get('/api/auth/me').set('Authorization', authorization)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    })
  })

  it('sem token devolve 401', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('unauthorized')
    expect(res.headers['www-authenticate']).toMatch(/^Bearer/)
  })

  it('com token invalido devolve 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer('abc.def.ghi'))

    expect(res.status).toBe(401)
  })

  it('com token expirado devolve 401', async () => {
    const { user } = await usuarioAutenticado()
    const vencido = jwt.sign({ sub: String(user.id), exp: Math.floor(Date.now() / 1000) - 10 }, TEST_SECRET)

    const res = await request(app).get('/api/auth/me').set('Authorization', bearer(vencido))

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/expirado/)
  })

  it('com token de outro segredo devolve 401', async () => {
    const { user } = await usuarioAutenticado()
    const forjado = createTokenService({ secret: 'z'.repeat(40), expiresIn: '1h' }).sign(user.id)

    const res = await request(app).get('/api/auth/me').set('Authorization', bearer(forjado))

    expect(res.status).toBe(401)
  })

  it('com token de usuario apagado devolve 401, nao 404 nem 500', async () => {
    const { user, authorization } = await usuarioAutenticado()
    await testDb.user.delete({ where: { id: user.id } })

    const res = await request(app).get('/api/auth/me').set('Authorization', authorization)

    expect(res.status).toBe(401)
  })

  it('com esquema Basic devolve 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Basic dXNlcjpwYXNz')

    expect(res.status).toBe(401)
  })
})
