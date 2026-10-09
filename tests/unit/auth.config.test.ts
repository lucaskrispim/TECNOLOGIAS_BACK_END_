import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BCRYPT_ROUNDS,
  DEFAULT_JWT_EXPIRES_IN,
  JWT_SECRET_MIN,
  loadAuthConfig,
} from '../../src/auth/auth.config'

const SEGREDO = 'x'.repeat(JWT_SECRET_MIN)

describe('loadAuthConfig', () => {
  it('le segredo, expiracao e custo do ambiente', () => {
    const config = loadAuthConfig({ JWT_SECRET: SEGREDO, JWT_EXPIRES_IN: '12h', BCRYPT_ROUNDS: '12' })

    expect(config).toEqual({ secret: SEGREDO, expiresIn: '12h', bcryptRounds: 12 })
  })

  it('usa 7d de expiracao e custo 10 quando as variaveis faltam', () => {
    const config = loadAuthConfig({ JWT_SECRET: SEGREDO })

    expect(DEFAULT_JWT_EXPIRES_IN).toBe('7d')
    expect(DEFAULT_BCRYPT_ROUNDS).toBe(10)
    expect(config.expiresIn).toBe('7d')
    expect(config.bcryptRounds).toBe(10)
  })

  it('trata variavel vazia como ausente', () => {
    const config = loadAuthConfig({ JWT_SECRET: SEGREDO, JWT_EXPIRES_IN: '  ', BCRYPT_ROUNDS: '' })

    expect(config.expiresIn).toBe('7d')
    expect(config.bcryptRounds).toBe(10)
  })

  it('recusa subir sem JWT_SECRET, em vez de assinar com segredo vazio', () => {
    expect(() => loadAuthConfig({})).toThrow(/JWT_SECRET/)
    expect(() => loadAuthConfig({ JWT_SECRET: '' })).toThrow(/JWT_SECRET/)
    expect(() => loadAuthConfig({ JWT_SECRET: '   ' })).toThrow(/JWT_SECRET/)
  })

  it('recusa segredo curto, um caractere abaixo do minimo', () => {
    expect(JWT_SECRET_MIN).toBe(32)
    expect(() => loadAuthConfig({ JWT_SECRET: 'x'.repeat(JWT_SECRET_MIN - 1) })).toThrow(/32/)
    expect(() => loadAuthConfig({ JWT_SECRET: 'x'.repeat(JWT_SECRET_MIN) })).not.toThrow()
  })

  it('aceita as formas de duracao que o jsonwebtoken entende', () => {
    for (const valor of ['60', '30s', '15m', '12h', '7d', '2w', '1y']) {
      expect(loadAuthConfig({ JWT_SECRET: SEGREDO, JWT_EXPIRES_IN: valor }).expiresIn, valor).toBe(
        valor,
      )
    }
  })

  it('recusa duracao fora do formato', () => {
    for (const valor of ['sete dias', '7 d', '-1d', '0', '0d', '1.5h', 'd']) {
      expect(() => loadAuthConfig({ JWT_SECRET: SEGREDO, JWT_EXPIRES_IN: valor }), valor).toThrow(
        /JWT_EXPIRES_IN/,
      )
    }
  })

  it('aceita custo de bcrypt de 4 a 15 e recusa o que fica fora', () => {
    expect(loadAuthConfig({ JWT_SECRET: SEGREDO, BCRYPT_ROUNDS: '4' }).bcryptRounds).toBe(4)
    expect(loadAuthConfig({ JWT_SECRET: SEGREDO, BCRYPT_ROUNDS: '15' }).bcryptRounds).toBe(15)

    for (const valor of ['3', '16', 'abc', '10.5', '-10']) {
      expect(() => loadAuthConfig({ JWT_SECRET: SEGREDO, BCRYPT_ROUNDS: valor }), valor).toThrow(
        /BCRYPT_ROUNDS/,
      )
    }
  })
})
