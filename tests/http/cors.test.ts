import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'

import { createApp } from '../../src/app'
import { DEFAULT_ALLOWED_ORIGIN, parseAllowedOrigins } from '../../src/http/cors'
import { createProductRepository } from '../../src/products/product.repository'
import { createProductService } from '../../src/products/product.service'
import { disconnectDb, testDb } from '../support/db'

const FRONT = 'http://localhost:5173'
const OUTRA = 'http://evil.example.com'

function appCom(allowedOrigins: string[]) {
  return createApp({
    products: createProductService(createProductRepository(testDb)),
    allowedOrigins,
  })
}

afterAll(disconnectDb)

describe('parseAllowedOrigins', () => {
  it('cai no front de desenvolvimento quando a variavel nao esta definida', () => {
    expect(DEFAULT_ALLOWED_ORIGIN).toBe(FRONT)
    expect(parseAllowedOrigins(undefined)).toEqual([FRONT])
    expect(parseAllowedOrigins('')).toEqual([FRONT])
    expect(parseAllowedOrigins('   ')).toEqual([FRONT])
  })

  it('aceita varias origens separadas por virgula, sem espaco sobrando', () => {
    expect(parseAllowedOrigins(' http://localhost:5173 , https://catalogo.exemplo.com ')).toEqual([
      FRONT,
      'https://catalogo.exemplo.com',
    ])
  })

  it('descarta entrada vazia no meio da lista', () => {
    expect(parseAllowedOrigins('http://localhost:5173,,')).toEqual([FRONT])
  })
})

describe('CORS na resposta', () => {
  const app = appCom([FRONT])

  it('libera a origem do front configurada', async () => {
    const res = await request(app).get('/api/products').set('Origin', FRONT)

    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe(FRONT)
  })

  it('nao devolve o cabecalho de liberacao para origem de fora da lista', async () => {
    const res = await request(app).get('/api/products').set('Origin', OUTRA)

    // O servidor responde; quem barra a leitura e o navegador, ao nao achar o
    // cabecalho. Por isso o teste olha o cabecalho, nao o status.
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('marca Vary com Origin, para nao envenenar cache com a resposta de outra origem', async () => {
    const res = await request(app).get('/api/products').set('Origin', FRONT)

    expect(res.headers.vary ?? '').toMatch(/Origin/i)
  })

  it('atende chamada sem Origin, como a do Insomnia ou do curl', async () => {
    const res = await request(app).get('/api/products')

    expect(res.status).toBe(200)
  })

  it('libera cada origem da lista quando ha mais de uma', async () => {
    const outroFront = 'https://catalogo.exemplo.com'
    const multi = appCom([FRONT, outroFront])

    for (const origem of [FRONT, outroFront]) {
      const res = await request(multi).get('/api/products').set('Origin', origem)
      expect(res.headers['access-control-allow-origin'], origem).toBe(origem)
    }
  })
})

describe('preflight', () => {
  const app = appCom([FRONT])

  it('responde a pergunta do navegador antes do PUT', async () => {
    const res = await request(app)
      .options('/api/products/1')
      .set('Origin', FRONT)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'content-type')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(FRONT)
    expect((res.headers['access-control-allow-headers'] ?? '').toLowerCase()).toContain(
      'content-type',
    )
  })

  it('anuncia os metodos do CRUD', async () => {
    const res = await request(app)
      .options('/api/products')
      .set('Origin', FRONT)
      .set('Access-Control-Request-Method', 'POST')

    const metodos = (res.headers['access-control-allow-methods'] ?? '').toUpperCase()
    for (const metodo of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      expect(metodos, metodo).toContain(metodo)
    }
  })

  it('nao libera preflight de origem estranha', async () => {
    const res = await request(app)
      .options('/api/products')
      .set('Origin', OUTRA)
      .set('Access-Control-Request-Method', 'DELETE')

    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
