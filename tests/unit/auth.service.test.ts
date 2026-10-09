import { describe, expect, it, vi } from 'vitest'

import { createAuthService } from '../../src/auth/auth.service'
import type { PasswordHasher } from '../../src/auth/password'
import type { TokenService } from '../../src/auth/token'
import type { User } from '../../src/generated/pg'
import { ConflictError, UnauthorizedError } from '../../src/http/errors'
import type { UserRepository } from '../../src/users/user.repository'

function usuario(over: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Maria Souza',
    email: 'maria@exemplo.com',
    passwordHash: 'hash:senha-forte-123',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }
}

/** Hasher falso e deterministico: o hash e a senha com prefixo. */
function hasherFalso(): PasswordHasher & { compare: ReturnType<typeof vi.fn> } {
  return {
    hash: vi.fn(async (senha: string) => `hash:${senha}`),
    compare: vi.fn(async (senha: string, hash: string) => hash === `hash:${senha}`),
  }
}

const tokensFalsos: TokenService = {
  sign: (id) => `token-${id}`,
  verify: () => ({ userId: 1 }),
}

function repoEmMemoria(inicial: User[] = []): UserRepository {
  const dados = [...inicial]
  return {
    create: vi.fn(async (input) => {
      if (dados.some((u) => u.email === input.email)) throw new ConflictError('e-mail ja cadastrado')
      const novo = usuario({ ...input, id: dados.length + 1 })
      dados.push(novo)
      return novo
    }),
    findByEmail: vi.fn(async (email) => dados.find((u) => u.email === email) ?? null),
    findById: vi.fn(async (id) => dados.find((u) => u.id === id) ?? null),
  }
}

const cadastro = { name: 'Maria Souza', email: 'maria@exemplo.com', password: 'senha-forte-123' }

describe('register', () => {
  it('grava o hash, nunca a senha, e devolve usuario e token', async () => {
    const users = repoEmMemoria()
    const auth = createAuthService({ users, hasher: hasherFalso(), tokens: tokensFalsos })

    const { user, token } = await auth.register(cadastro)

    expect(users.create).toHaveBeenCalledWith({
      name: 'Maria Souza',
      email: 'maria@exemplo.com',
      passwordHash: 'hash:senha-forte-123',
    })
    expect(user.id).toBe(1)
    expect(token).toBe('token-1')
  })

  it('devolve 409 para e-mail ja cadastrado, sem gerar token', async () => {
    const users = repoEmMemoria([usuario()])
    const auth = createAuthService({ users, hasher: hasherFalso(), tokens: tokensFalsos })

    await expect(auth.register(cadastro)).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('login', () => {
  it('devolve usuario e token com a senha certa', async () => {
    const auth = createAuthService({
      users: repoEmMemoria([usuario({ id: 9 })]),
      hasher: hasherFalso(),
      tokens: tokensFalsos,
    })

    const { user, token } = await auth.login({ email: 'maria@exemplo.com', password: 'senha-forte-123' })

    expect(user.id).toBe(9)
    expect(token).toBe('token-9')
  })

  it('recusa senha errada com 401', async () => {
    const auth = createAuthService({
      users: repoEmMemoria([usuario()]),
      hasher: hasherFalso(),
      tokens: tokensFalsos,
    })

    await expect(auth.login({ email: 'maria@exemplo.com', password: 'errada' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
  })

  it('da a mesma resposta para e-mail inexistente e senha errada', async () => {
    const auth = createAuthService({
      users: repoEmMemoria([usuario()]),
      hasher: hasherFalso(),
      tokens: tokensFalsos,
    })

    const semConta = await auth.login({ email: 'ninguem@exemplo.com', password: 'x' }).catch((e) => e)
    const senhaErrada = await auth.login({ email: 'maria@exemplo.com', password: 'x' }).catch((e) => e)

    expect(semConta).toBeInstanceOf(UnauthorizedError)
    expect(semConta.message).toBe(senhaErrada.message)
    expect(semConta.status).toBe(senhaErrada.status)
  })

  it('roda o bcrypt mesmo quando o e-mail nao existe, para nao vazar por tempo', async () => {
    const hasher = hasherFalso()
    const auth = createAuthService({ users: repoEmMemoria(), hasher, tokens: tokensFalsos })

    await auth.login({ email: 'ninguem@exemplo.com', password: 'x' }).catch(() => undefined)

    expect(hasher.compare).toHaveBeenCalledTimes(1)
  })
})

describe('me', () => {
  it('devolve o usuario do token', async () => {
    const auth = createAuthService({
      users: repoEmMemoria([usuario({ id: 1 })]),
      hasher: hasherFalso(),
      tokens: tokensFalsos,
    })

    expect((await auth.me(1)).email).toBe('maria@exemplo.com')
  })

  it('devolve 401 quando o usuario do token nao existe mais', async () => {
    const auth = createAuthService({ users: repoEmMemoria(), hasher: hasherFalso(), tokens: tokensFalsos })

    await expect(auth.me(77)).rejects.toBeInstanceOf(UnauthorizedError)
  })
})
