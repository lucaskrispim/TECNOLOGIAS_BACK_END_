import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

import { createApp } from '../../src/app'
import type { ProductService } from '../../src/products/product.service'

/** Service que estoura, para exercitar o caminho do erro nao previsto. */
function servicoQueFalha(erro: Error): ProductService {
  const falhar = async () => {
    throw erro
  }
  return {
    list: falhar,
    get: falhar,
    create: falhar,
    replace: falhar,
    remove: falhar,
  } as unknown as ProductService
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('erro nao previsto', () => {
  it('vira 500 em JSON, sem stack e sem a mensagem interna no corpo', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = createApp({ products: servicoQueFalha(new Error('senha do banco no texto')) })

    const res = await request(app).get('/products')

    expect(res.status).toBe(500)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({
      error: 'internal_error',
      message: 'erro inesperado ao processar a requisicao',
    })
    expect(res.text).not.toContain('senha do banco')
    expect(res.text).not.toContain('at ')
    // O detalhe nao se perde, vai para o log do servidor.
    expect(log).toHaveBeenCalled()
  })
})

describe('corpo malformado', () => {
  it('JSON invalido vira 400, nao 500', async () => {
    const app = createApp({ products: servicoQueFalha(new Error('nao deveria chegar aqui')) })

    const res = await request(app)
      .post('/products')
      .set('content-type', 'application/json')
      .send('{"title": "sem fechar"')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('bad_request')
  })
})

describe('forma da resposta de erro', () => {
  it('e a mesma em 400, 404 e 500', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = createApp({ products: servicoQueFalha(new Error('boom')) })

    const respostas = [
      await request(app).get('/products/abc'),
      await request(app).get('/rota-que-nao-existe'),
      await request(app).get('/products'),
    ]

    expect(respostas.map((r) => r.status)).toEqual([400, 404, 500])
    for (const res of respostas) {
      expect(Object.keys(res.body).every((k) => ['error', 'message', 'details'].includes(k))).toBe(
        true,
      )
      expect(typeof res.body.error).toBe('string')
      expect(typeof res.body.message).toBe('string')
    }
    expect(log).toHaveBeenCalledTimes(1)
  })
})
