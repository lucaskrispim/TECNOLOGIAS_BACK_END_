import type { RequestHandler, Response } from 'express'

import { UnauthorizedError } from '../http/errors'
import type { TokenService } from './token'

/** Esquema Bearer em qualquer caixa, seguido de exatamente um token. */
const BEARER = /^Bearer\s+(\S+)$/i

/**
 * Protege a rota: sem cabecalho, com esquema diferente de Bearer ou com token
 * que nao passa na verificacao, a requisicao para aqui com 401. O id do
 * usuario fica em res.locals para o handler seguinte.
 *
 * O middleware nao consulta o banco. Token de conta apagada continua valendo
 * para escrever ate expirar, que e o preco do JWT sem estado; o /me, que
 * precisa do registro, recusa esse caso.
 */
export function createRequireAuth(tokens: TokenService): RequestHandler {
  return (req, res, next) => {
    try {
      res.locals.userId = tokens.verify(extrairToken(req.headers.authorization)).userId
      next()
    } catch (erro) {
      next(erro)
    }
  }
}

function extrairToken(cabecalho: string | string[] | undefined): string {
  if (typeof cabecalho !== 'string' || cabecalho.trim().length === 0) {
    throw new UnauthorizedError('token ausente: envie Authorization: Bearer <token>')
  }

  const token = BEARER.exec(cabecalho.trim())?.[1]
  if (token === undefined) {
    throw new UnauthorizedError('cabecalho Authorization invalido: use Bearer <token>')
  }

  return token
}

/** Id do usuario autenticado. So existe em rota que passou pelo requireAuth. */
export function authenticatedUserId(res: Response): number {
  const userId: unknown = res.locals.userId
  if (typeof userId !== 'number') throw new UnauthorizedError()
  return userId
}
