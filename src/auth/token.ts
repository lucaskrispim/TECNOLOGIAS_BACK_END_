import jwt from 'jsonwebtoken'

import { UnauthorizedError } from '../http/errors'

export interface TokenService {
  sign(userId: number): string
  verify(token: string): { userId: number }
}

export interface TokenConfig {
  secret: string
  expiresIn: string
}

/**
 * Algoritmo fixo na assinatura e na verificacao. Sem a lista no verify, um
 * token com alg none ou com outro algoritmo poderia ser aceito.
 */
const ALGORITMO = 'HS256'

export function createTokenService({ secret, expiresIn }: TokenConfig): TokenService {
  if (secret.length === 0) throw new Error('segredo do JWT vazio')

  return {
    sign: (userId) =>
      jwt.sign({}, secret, {
        algorithm: ALGORITMO,
        subject: String(userId),
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      }),

    verify(token) {
      let payload: string | jwt.JwtPayload
      try {
        payload = jwt.verify(token, secret, { algorithms: [ALGORITMO] })
      } catch (erro) {
        if (erro instanceof jwt.TokenExpiredError) throw new UnauthorizedError('token expirado')
        throw new UnauthorizedError('token invalido')
      }

      // O sub e texto pela especificacao do JWT, e aqui tem de ser um id.
      const sub = typeof payload === 'object' ? payload.sub : undefined
      const userId = Number(sub)
      if (typeof sub !== 'string' || !/^\d+$/.test(sub) || !Number.isSafeInteger(userId) || userId <= 0) {
        throw new UnauthorizedError('token invalido')
      }

      return { userId }
    },
  }
}
