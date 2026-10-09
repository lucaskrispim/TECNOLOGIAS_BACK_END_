import { describe, expect, it } from 'vitest'

import { createPasswordHasher } from '../../src/auth/password'

const hasher = createPasswordHasher(4)

describe('createPasswordHasher', () => {
  it('gera hash bcrypt com o custo configurado, nunca a senha em claro', async () => {
    const hash = await hasher.hash('senha-forte-123')

    expect(hash).toMatch(/^\$2[aby]\$04\$.{53}$/)
    expect(hash).not.toContain('senha-forte-123')
  })

  it('gera hash diferente para a mesma senha, por causa do sal', async () => {
    const [a, b] = await Promise.all([hasher.hash('mesma'), hasher.hash('mesma')])

    expect(a).not.toBe(b)
  })

  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hasher.hash('senha-forte-123')

    expect(await hasher.compare('senha-forte-123', hash)).toBe(true)
    expect(await hasher.compare('senha-forte-124', hash)).toBe(false)
    expect(await hasher.compare('Senha-forte-123', hash)).toBe(false)
    expect(await hasher.compare('', hash)).toBe(false)
  })

  it('diferencia senha com espaco nas pontas', async () => {
    const hash = await hasher.hash(' abc123 ')

    expect(await hasher.compare('abc123', hash)).toBe(false)
    expect(await hasher.compare(' abc123 ', hash)).toBe(true)
  })

  it('aceita senha com acento e emoji', async () => {
    const senha = 'açúcar-🔑-123'
    const hash = await hasher.hash(senha)

    expect(await hasher.compare(senha, hash)).toBe(true)
    expect(await hasher.compare('acucar-🔑-123', hash)).toBe(false)
  })

  it('devolve false, sem estourar, para hash corrompido', async () => {
    expect(await hasher.compare('qualquer', 'nao-e-hash-bcrypt')).toBe(false)
    expect(await hasher.compare('qualquer', '')).toBe(false)
  })

  it('usa o custo informado na criacao', async () => {
    const outro = createPasswordHasher(5)

    expect(await outro.hash('x')).toMatch(/^\$2[aby]\$05\$/)
  })
})
