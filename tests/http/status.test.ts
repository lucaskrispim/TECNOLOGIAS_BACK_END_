import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'

import { makeTestApp } from '../support/app'
import { disconnectDb } from '../support/db'

describe('GET /', () => {
  const app = makeTestApp()

  afterAll(disconnectDb)

  it('responde 200', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
  })

  it('devolve exatamente o status da API', async () => {
    const res = await request(app).get('/')
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('responde em JSON', async () => {
    const res = await request(app).get('/')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})
