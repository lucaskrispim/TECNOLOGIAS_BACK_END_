import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb } from '../support/db'
import { productInput } from '../support/factories'

/**
 * Ponta a ponta de verdade: a API sobe num socket, em porta escolhida pelo
 * sistema, e o teste fala com ela por fetch, como o Insomnia ou o front
 * fariam. Nada de Supertest aqui, para exercitar tambem a camada de rede.
 */
let server: Server
let base: string

beforeAll(async () => {
  server = makeTestApp({ allowedOrigins: ['http://localhost:5173'] }).listen(0)
  await new Promise<void>((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
  await disconnectDb()
})

beforeEach(resetDb)

async function chamar(
  metodo: string,
  caminho: string,
  { token, corpo, cabecalhos = {} }: { token?: string; corpo?: unknown; cabecalhos?: Record<string, string> } = {},
) {
  const res = await fetch(base + caminho, {
    method: metodo,
    headers: {
      ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...cabecalhos,
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  const texto = await res.text()
  return { status: res.status, headers: res.headers, body: texto ? JSON.parse(texto) : undefined }
}

describe('jornada completa de autenticacao e escrita', () => {
  it('registra, consulta o perfil, escreve em products, faz login de novo e continua escrevendo', async () => {
    const cadastro = { name: 'Paula Lima', email: 'paula@exemplo.com', password: 'senha-123' }

    // 1. Sem conta, escrever falha.
    expect((await chamar('POST', '/api/products', { corpo: productInput() })).status).toBe(401)

    // 2. Registro devolve token.
    const registro = await chamar('POST', '/api/auth/register', { corpo: cadastro })
    expect(registro.status).toBe(201)
    const tokenRegistro: string = registro.body.token

    // 3. O token do registro ja abre o /me.
    const perfil = await chamar('GET', '/api/auth/me', { token: tokenRegistro })
    expect(perfil.status).toBe(200)
    expect(perfil.body.user.email).toBe('paula@exemplo.com')

    // 4. Com token, cria, altera e le o produto.
    const criado = await chamar('POST', '/api/products', { token: tokenRegistro, corpo: productInput() })
    expect(criado.status).toBe(201)
    const id: number = criado.body.id

    const alterado = await chamar('PUT', `/api/products/${id}`, {
      token: tokenRegistro,
      corpo: { price: '299.90' },
    })
    expect(alterado.status).toBe(200)
    expect(alterado.body.price).toBe('299.90')

    // 5. Leitura continua publica.
    const lista = await chamar('GET', '/api/products')
    expect(lista.status).toBe(200)
    expect(lista.body.map((p: { id: number }) => p.id)).toContain(id)

    // 6. Login com senha errada falha, com a certa devolve novo token.
    expect(
      (await chamar('POST', '/api/auth/login', { corpo: { email: cadastro.email, password: 'errada' } }))
        .status,
    ).toBe(401)
    const login = await chamar('POST', '/api/auth/login', {
      corpo: { email: cadastro.email, password: cadastro.password },
    })
    expect(login.status).toBe(200)
    expect(login.body.user.id).toBe(registro.body.user.id)

    // 7. O token do login apaga o produto; depois disso ele some da leitura.
    expect((await chamar('DELETE', `/api/products/${id}`, { token: login.body.token })).status).toBe(204)
    expect((await chamar('GET', `/api/products/${id}`)).status).toBe(404)
  })

  it('segundo registro com o mesmo e-mail falha sem derrubar o primeiro usuario', async () => {
    const cadastro = { name: 'Rui', email: 'rui@exemplo.com', password: 'senha-123' }
    await chamar('POST', '/api/auth/register', { corpo: cadastro })

    const repetido = await chamar('POST', '/api/auth/register', {
      corpo: { ...cadastro, password: 'outra-senha' },
    })
    const login = await chamar('POST', '/api/auth/login', {
      corpo: { email: cadastro.email, password: cadastro.password },
    })

    expect(repetido.status).toBe(409)
    expect(login.status).toBe(200)
  })
})

describe('navegador no front da 5173', () => {
  it('o preflight libera o cabecalho Authorization para o POST', async () => {
    const res = await chamar('OPTIONS', '/api/products', {
      cabecalhos: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect((res.headers.get('access-control-allow-headers') ?? '').toLowerCase()).toContain(
      'authorization',
    )
  })

  it('a resposta 401 tambem leva o cabecalho de CORS, para o front ler o erro', async () => {
    const res = await chamar('POST', '/api/products', {
      corpo: productInput(),
      cabecalhos: { origin: 'http://localhost:5173' },
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })
})
