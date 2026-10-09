import type { User } from '../generated/pg'
import { UnauthorizedError } from '../http/errors'
import type { UserRepository } from '../users/user.repository'
import type { LoginInput, RegisterInput } from './auth.schema'
import type { PasswordHasher } from './password'
import type { TokenService } from './token'

export interface AuthResult {
  user: User
  token: string
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResult>
  login(input: LoginInput): Promise<AuthResult>
  me(userId: number): Promise<User>
}

export interface AuthServiceDeps {
  users: UserRepository
  hasher: PasswordHasher
  tokens: TokenService
}

/**
 * Hash bcrypt valido de uma senha que ninguem usa. Quando o e-mail nao existe,
 * o login compara contra ele mesmo assim, para gastar o mesmo tempo do caso de
 * senha errada e nao revelar pela latencia quais e-mails tem conta.
 */
const HASH_DE_DESPISTE = '$2b$10$qVfsOGnhDJjUd.rktMjsyuHxsOrOfe8Xved6xj7UC7Aeojj/zq7Jm'

export function createAuthService({ users, hasher, tokens }: AuthServiceDeps): AuthService {
  // Mesma mensagem para e-mail ausente e senha errada, pelo mesmo motivo.
  const credenciaisInvalidas = () => new UnauthorizedError('email ou senha invalidos')

  return {
    async register({ name, email, password }) {
      const user = await users.create({ name, email, passwordHash: await hasher.hash(password) })
      return { user, token: tokens.sign(user.id) }
    },

    async login({ email, password }) {
      const user = await users.findByEmail(email)
      const confere = await hasher.compare(password, user?.passwordHash ?? HASH_DE_DESPISTE)
      if (user === null || !confere) throw credenciaisInvalidas()
      return { user, token: tokens.sign(user.id) }
    },

    // Token valido de conta apagada e credencial que nao vale mais: 401.
    async me(userId) {
      const user = await users.findById(userId)
      if (user === null) throw new UnauthorizedError('usuario do token nao existe mais')
      return user
    },
  }
}
