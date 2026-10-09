import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { authenticatedUserId, createRequireAuth } from '../../src/auth/auth.middleware'
import { createTokenService } from '../../src/auth/token'
import { UnauthorizedError } from '../../src/http/errors'

const tokens = createTokenService({
  secret: 'segredo-do-middleware-com-mais-de-32-caracteres',
  expiresIn: '1h',
})
const requireAuth = createRequireAuth(tokens)

/** Roda o middleware com um cabecalho Authorization e devolve o que ele fez. */
function rodar(authorization?: string | string[]) {
  const req = { headers: authorization === undefined ? {} : { authorization } } as Request
  const res = { locals: {} } as Response
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>

  requireAuth(req, res, next)

  const chamada = (next as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[] | undefined
  return { res, next, erro: chamada?.[0] }
}

describe('requireAuth', () => {
  it('deixa passar token valido e guarda o id do usuario', () => {
    const { res, next, erro } = rodar(`Bearer ${tokens.sign(5)}`)

    expect(next).toHaveBeenCalledTimes(1)
    expect(erro).toBeUndefined()
    expect(authenticatedUserId(res)).toBe(5)
  })

  it('aceita o esquema Bearer em qualquer caixa e com espacos extras', () => {
    for (const esquema of ['bearer', 'BEARER', 'BeArEr']) {
      const { erro, res } = rodar(`${esquema}   ${tokens.sign(3)}  `)
      expect(erro, esquema).toBeUndefined()
      expect(authenticatedUserId(res)).toBe(3)
    }
  })

  it('recusa requisicao sem cabecalho com 401 e mensagem de token ausente', () => {
    const { erro } = rodar()

    expect(erro).toBeInstanceOf(UnauthorizedError)
    expect((erro as UnauthorizedError).status).toBe(401)
    expect((erro as UnauthorizedError).message).toMatch(/ausente/)
  })

  it('recusa cabecalho vazio ou so com espaco', () => {
    for (const valor of ['', '   ']) {
      expect(rodar(valor).erro, JSON.stringify(valor)).toBeInstanceOf(UnauthorizedError)
    }
  })

  it('recusa esquema diferente de Bearer', () => {
    const token = tokens.sign(1)
    for (const valor of [`Basic ${token}`, `Token ${token}`, `JWT ${token}`, token]) {
      const { erro } = rodar(valor)
      expect(erro, valor).toBeInstanceOf(UnauthorizedError)
      expect((erro as UnauthorizedError).message, valor).toMatch(/Bearer/)
    }
  })

  it('recusa Bearer sem token ou com mais de um pedaco', () => {
    const token = tokens.sign(1)
    for (const valor of ['Bearer', 'Bearer ', `Bearer ${token} extra`, `Bearer  ${token} ${token}`]) {
      expect(rodar(valor).erro, valor).toBeInstanceOf(UnauthorizedError)
    }
  })

  it('recusa token invalido sem guardar usuario', () => {
    const { erro, res } = rodar('Bearer nao.e.jwt')

    expect(erro).toBeInstanceOf(UnauthorizedError)
    expect(res.locals.userId).toBeUndefined()
  })

  it('recusa cabecalho repetido, que chega como lista', () => {
    const token = tokens.sign(1)

    expect(rodar([`Bearer ${token}`, `Bearer ${token}`]).erro).toBeInstanceOf(UnauthorizedError)
  })

  it('chama next uma unica vez, mesmo na falha', () => {
    expect(rodar('Bearer x').next).toHaveBeenCalledTimes(1)
    expect(rodar().next).toHaveBeenCalledTimes(1)
  })
})

describe('authenticatedUserId', () => {
  it('estoura 401 quando a rota nao passou pelo middleware', () => {
    expect(() => authenticatedUserId({ locals: {} } as Response)).toThrow(UnauthorizedError)
  })
})
