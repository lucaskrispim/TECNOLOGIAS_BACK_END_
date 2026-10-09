import { describe, expect, it } from 'vitest'

import {
  EMAIL_MAX,
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  loginSchema,
  registerSchema,
} from '../../src/auth/auth.schema'

const valido = { name: 'Maria Souza', email: 'maria@exemplo.com', password: 'abc123' }

function campos(resultado: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (resultado.error?.issues ?? []).map((i) => i.path.join('.')).sort()
}

describe('registerSchema', () => {
  it('aceita o cadastro valido', () => {
    expect(registerSchema.parse(valido)).toEqual(valido)
  })

  it('normaliza o e-mail: apara as pontas e passa para minusculas', () => {
    const r = registerSchema.parse({ ...valido, email: '  Maria@Exemplo.COM ' })

    expect(r.email).toBe('maria@exemplo.com')
  })

  it('apara o nome mas nunca a senha', () => {
    const r = registerSchema.parse({ ...valido, name: '  Maria  ', password: '  abc123  ' })

    expect(r.name).toBe('Maria')
    expect(r.password).toBe('  abc123  ')
  })

  it('recusa e-mail fora do formato', () => {
    for (const email of ['', 'maria', 'maria@', '@exemplo.com', 'maria@exemplo', 'ma ria@exemplo.com', 'maria@@exemplo.com']) {
      const r = registerSchema.safeParse({ ...valido, email })
      expect(r.success, email).toBe(false)
      expect(campos(r), email).toEqual(['email'])
    }
  })

  it('recusa e-mail acima de 254 caracteres', () => {
    const dominio = '@exemplo.com'
    const noLimite = 'a'.repeat(64) + '@' + 'b'.repeat(EMAIL_MAX - 64 - 1 - 4) + '.com'
    const acima = 'a'.repeat(64) + '@' + 'b'.repeat(EMAIL_MAX - 64 - 4) + '.com'

    expect(EMAIL_MAX).toBe(254)
    expect(dominio.length).toBeLessThan(EMAIL_MAX)
    expect(noLimite.length).toBe(EMAIL_MAX)
    expect(acima.length).toBe(EMAIL_MAX + 1)
    expect(registerSchema.safeParse({ ...valido, email: acima }).success).toBe(false)
  })

  it('exige senha de no minimo 6 caracteres: 5 falha, 6 passa', () => {
    expect(PASSWORD_MIN).toBe(6)

    const cinco = registerSchema.safeParse({ ...valido, password: '12345' })
    const seis = registerSchema.safeParse({ ...valido, password: '123456' })

    expect(cinco.success).toBe(false)
    expect(campos(cinco)).toEqual(['password'])
    expect(cinco.error?.issues[0]?.message).toMatch(/6/)
    expect(seis.success).toBe(true)
  })

  it('conta espacos na senha, ja que ela nao e aparada', () => {
    expect(registerSchema.safeParse({ ...valido, password: '      ' }).success).toBe(true)
    expect(registerSchema.safeParse({ ...valido, password: '     ' }).success).toBe(false)
  })

  it('recusa senha acima de 72 bytes, o limite do bcrypt', () => {
    expect(PASSWORD_MAX_BYTES).toBe(72)

    expect(registerSchema.safeParse({ ...valido, password: 'a'.repeat(72) }).success).toBe(true)
    expect(registerSchema.safeParse({ ...valido, password: 'a'.repeat(73) }).success).toBe(false)
  })

  it('mede o limite da senha em bytes, nao em caracteres', () => {
    // "e" com acento ocupa 2 bytes em UTF-8: 36 deles ja somam 72 bytes.
    expect(registerSchema.safeParse({ ...valido, password: 'é'.repeat(36) }).success).toBe(true)
    expect(registerSchema.safeParse({ ...valido, password: 'é'.repeat(37) }).success).toBe(false)
  })

  it('aplica os limites do nome depois de aparar', () => {
    expect(NAME_MIN).toBe(2)
    expect(NAME_MAX).toBe(120)

    expect(registerSchema.safeParse({ ...valido, name: ' a ' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...valido, name: 'ab' }).success).toBe(true)
    expect(registerSchema.safeParse({ ...valido, name: 'a'.repeat(120) }).success).toBe(true)
    expect(registerSchema.safeParse({ ...valido, name: 'a'.repeat(121) }).success).toBe(false)
  })

  it('acusa todos os campos invalidos de uma vez', () => {
    const r = registerSchema.safeParse({ name: '', email: 'x', password: '1' })

    expect(campos(r)).toEqual(['email', 'name', 'password'])
  })

  it('recusa tipo errado em cada campo', () => {
    const r = registerSchema.safeParse({ name: 1, email: ['a@b.com'], password: 123456 })

    expect(campos(r)).toEqual(['email', 'name', 'password'])
  })

  it('recusa corpo ausente ou que nao e objeto', () => {
    for (const corpo of [undefined, null, 'texto', 42, []]) {
      expect(registerSchema.safeParse(corpo).success, String(corpo)).toBe(false)
    }
  })

  it('descarta campo desconhecido, como id ou passwordHash enviado pelo cliente', () => {
    const r = registerSchema.parse({ ...valido, id: 1, passwordHash: 'x', role: 'admin' })

    expect(Object.keys(r).sort()).toEqual(['email', 'name', 'password'])
  })
})

describe('loginSchema', () => {
  it('aceita e-mail e senha e normaliza o e-mail', () => {
    expect(loginSchema.parse({ email: ' Maria@Exemplo.com', password: 'qualquer' })).toEqual({
      email: 'maria@exemplo.com',
      password: 'qualquer',
    })
  })

  it('nao aplica o minimo de 6 do registro, so exige senha nao vazia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '1' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })

  it('recusa senha acima de 72 bytes tambem no login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'a'.repeat(73) }).success).toBe(
      false,
    )
  })

  it('recusa e-mail invalido e campos ausentes', () => {
    expect(campos(loginSchema.safeParse({ email: 'nao-e-email', password: 'x' }))).toEqual(['email'])
    expect(campos(loginSchema.safeParse({}))).toEqual(['email', 'password'])
  })
})
