import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTokenService } from '../../src/auth/token'
import { UnauthorizedError } from '../../src/http/errors'

const SEGREDO = 'segredo-de-teste-unitario-com-mais-de-32-caracteres'
const tokens = createTokenService({ secret: SEGREDO, expiresIn: '7d' })

/** Assina um payload arbitrario com o segredo certo, para testar o verify. */
function assinar(payload: object, opcoes: jwt.SignOptions = {}): string {
  return jwt.sign(payload, SEGREDO, { algorithm: 'HS256', ...opcoes })
}

/** Token sem assinatura, com alg none no cabecalho. */
function tokenSemAssinatura(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`
}

afterEach(() => {
  vi.useRealTimers()
})

describe('sign', () => {
  it('gera JWT HS256 com o id do usuario em sub', () => {
    const token = tokens.sign(42)
    const decodificado = jwt.decode(token, { complete: true })

    expect(token.split('.')).toHaveLength(3)
    expect(decodificado?.header.alg).toBe('HS256')
    expect((decodificado?.payload as jwt.JwtPayload).sub).toBe('42')
  })

  it('poe expiracao de 7 dias a partir de agora', () => {
    const payload = jwt.decode(tokens.sign(1)) as jwt.JwtPayload

    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(7 * 24 * 60 * 60)
  })

  it('nao carrega dado sensivel no payload, so sub, iat e exp', () => {
    const payload = jwt.decode(tokens.sign(1)) as jwt.JwtPayload

    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub'])
  })
})

describe('verify', () => {
  it('devolve o id de um token valido', () => {
    expect(tokens.verify(tokens.sign(7))).toEqual({ userId: 7 })
  })

  it('aceita token assinado ate o ultimo segundo antes de expirar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const curto = createTokenService({ secret: SEGREDO, expiresIn: '60s' })
    const token = curto.sign(1)

    vi.setSystemTime(new Date('2026-01-01T00:00:59Z'))
    expect(curto.verify(token)).toEqual({ userId: 1 })
  })

  it('recusa token expirado com 401 e mensagem propria', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const curto = createTokenService({ secret: SEGREDO, expiresIn: '60s' })
    const token = curto.sign(1)

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    expect(() => curto.verify(token)).toThrow(UnauthorizedError)
    expect(() => curto.verify(token)).toThrow(/expirado/)
  })

  it('recusa token assinado com outro segredo', () => {
    const outro = createTokenService({ secret: 'outro-segredo-bem-comprido-tambem-32+', expiresIn: '1h' })

    expect(() => tokens.verify(outro.sign(1))).toThrow(UnauthorizedError)
  })

  it('recusa token com alg none, mesmo com payload plausivel', () => {
    const forjado = tokenSemAssinatura({ sub: '1', iat: Math.floor(Date.now() / 1000) })

    expect(() => tokens.verify(forjado)).toThrow(UnauthorizedError)
  })

  it('recusa algoritmo diferente do fixado, mesmo com o segredo certo', () => {
    const hs512 = jwt.sign({ sub: '1' }, SEGREDO, { algorithm: 'HS512' })

    expect(() => tokens.verify(hs512)).toThrow(UnauthorizedError)
  })

  it('recusa token com payload adulterado', () => {
    const [cabecalho, , assinatura] = tokens.sign(1).split('.')
    const payloadForjado = Buffer.from(JSON.stringify({ sub: '999' })).toString('base64url')

    expect(() => tokens.verify(`${cabecalho}.${payloadForjado}.${assinatura}`)).toThrow(
      UnauthorizedError,
    )
  })

  it('recusa texto que nao e JWT', () => {
    for (const lixo of ['', 'abc', 'a.b', 'a.b.c', '...', 'Bearer xyz', ' ']) {
      expect(() => tokens.verify(lixo), JSON.stringify(lixo)).toThrow(UnauthorizedError)
    }
  })

  it('recusa token valido sem sub ou com sub que nao e id', () => {
    for (const payload of [{}, { sub: '' }, { sub: 'abc' }, { sub: '0' }, { sub: '-1' }, { sub: '1.5' }, { sub: '9007199254740993' }]) {
      expect(() => tokens.verify(assinar(payload)), JSON.stringify(payload)).toThrow(
        UnauthorizedError,
      )
    }
  })

  it('recusa token cujo payload e texto puro, sem claims', () => {
    expect(() => tokens.verify(jwt.sign('1', SEGREDO, { algorithm: 'HS256' }))).toThrow(
      UnauthorizedError,
    )
  })

  it('recusa sub numerico em vez de texto', () => {
    expect(() => tokens.verify(assinar({ sub: 1 }))).toThrow(UnauthorizedError)
  })

  it('recusa token ainda nao valido, com nbf no futuro', () => {
    expect(() => tokens.verify(assinar({ sub: '1' }, { notBefore: '1h' }))).toThrow(
      UnauthorizedError,
    )
  })
})

describe('createTokenService', () => {
  it('recusa segredo vazio na criacao', () => {
    expect(() => createTokenService({ secret: '', expiresIn: '7d' })).toThrow()
  })
})
