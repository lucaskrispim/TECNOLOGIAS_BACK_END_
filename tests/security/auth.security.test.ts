import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

import { bearer, usuarioAutenticado } from '../support/auth'
import { makeTestApp } from '../support/app'
import { disconnectDb, resetDb, testDb } from '../support/db'
import { productInput, userInput } from '../support/factories'

const app = makeTestApp()

beforeEach(resetDb)
afterAll(disconnectDb)

describe('senha', () => {
  it('fica guardada como hash bcrypt, nunca em claro', async () => {
    const entrada = userInput({ password: 'minha-senha-secreta' })

    await request(app).post('/api/auth/register').send(entrada)
    const gravado = await testDb.user.findUniqueOrThrow({ where: { email: entrada.email } })

    expect(gravado.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/)
    expect(gravado.passwordHash).not.toContain('minha-senha-secreta')
  })

  it('nem a senha nem o hash aparecem em register, login ou me', async () => {
    const entrada = userInput({ password: 'minha-senha-secreta' })

    const registro = await request(app).post('/api/auth/register').send(entrada)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: entrada.email, password: entrada.password })
    const me = await request(app).get('/api/auth/me').set('Authorization', bearer(login.body.token))

    for (const res of [registro, login, me]) {
      expect(res.text).not.toContain('minha-senha-secreta')
      expect(res.text).not.toContain('passwordHash')
      expect(res.text).not.toMatch(/\$2[aby]\$/)
    }
  })
})

describe('enumeracao de conta', () => {
  it('e-mail inexistente e senha errada dao resposta identica', async () => {
    const { user } = await usuarioAutenticado()

    const semConta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: 'qualquer' })
    const senhaErrada = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'qualquer' })

    expect(semConta.status).toBe(senhaErrada.status)
    expect(semConta.body).toEqual(senhaErrada.body)
  })
})

describe('atribuicao em massa', () => {
  it('id e passwordHash enviados no registro sao ignorados', async () => {
    const entrada = { ...userInput({ password: 'senha-de-verdade' }), id: 4242, passwordHash: 'hackeado' }

    const res = await request(app).post('/api/auth/register').send(entrada)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: entrada.email, password: 'senha-de-verdade' })

    expect(res.status).toBe(201)
    expect(res.body.user.id).not.toBe(4242)
    expect(login.status).toBe(200)
  })
})

describe('entrada hostil', () => {
  it('objeto no lugar do e-mail, no estilo de injecao NoSQL, da 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } })

    expect(res.status).toBe(400)
  })

  it('e-mail com trecho de SQL e recusado na validacao, sem chegar ao banco', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "' OR 1=1 --", password: 'x' })

    expect(res.status).toBe(400)
  })

  it('token gigante da 401, nao 500', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearer('a'.repeat(8000)))
      .send(productInput())

    expect(res.status).toBe(401)
  })

  it('token sem assinatura, com alg none, nao escreve em products', async () => {
    const { user } = await usuarioAutenticado()
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const forjado = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: String(user.id) })}.`

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', bearer(forjado))
      .send(productInput())

    expect(res.status).toBe(401)
    expect(await testDb.product.count()).toBe(0)
  })

  it('a mensagem de 401 nao repassa o texto interno da biblioteca de JWT', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer('a.b.c'))

    expect(res.text).not.toMatch(/jwt malformed|invalid token|invalid signature/i)
  })
})
