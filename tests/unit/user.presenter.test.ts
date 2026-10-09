import { describe, expect, it } from 'vitest'

import type { User } from '../../src/generated/pg'
import { toApi } from '../../src/users/user.presenter'

const user: User = {
  id: 3,
  name: 'Maria Souza',
  email: 'maria@exemplo.com',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234',
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
  updatedAt: new Date('2026-10-02T08:30:00.000Z'),
}

describe('toApi de usuario', () => {
  it('expoe id, nome, e-mail e datas em ISO', () => {
    expect(toApi(user)).toEqual({
      id: 3,
      name: 'Maria Souza',
      email: 'maria@exemplo.com',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-02T08:30:00.000Z',
    })
  })

  it('nunca expoe o hash da senha', () => {
    const saida = toApi(user)

    expect(saida).not.toHaveProperty('passwordHash')
    expect(saida).not.toHaveProperty('password')
    expect(JSON.stringify(saida)).not.toContain('$2b$')
  })
})
