import { createPasswordHasher } from '../../src/auth/password'
import { createTokenService } from '../../src/auth/token'
import type { User } from '../../src/generated/pg'
import { createUserRepository } from '../../src/users/user.repository'
import { testDb } from './db'
import { userInput } from './factories'

/** Segredo so da suite. Tem o tamanho minimo que a configuracao exige. */
export const TEST_SECRET = 'segredo-da-suite-de-testes-com-32-caracteres-ou-mais'

/** Custo minimo do bcrypt: a suite verifica o fluxo, nao a resistencia do hash. */
export const TEST_BCRYPT_ROUNDS = 4

export const testHasher = createPasswordHasher(TEST_BCRYPT_ROUNDS)
export const testTokens = createTokenService({ secret: TEST_SECRET, expiresIn: '1h' })

export function bearer(token: string): string {
  return `Bearer ${token}`
}

/**
 * Grava um usuario direto no banco, sem passar pela rota de registro, e
 * devolve o token dele. Serve aos testes de produto, que precisam de alguem
 * autenticado mas nao estao testando o registro.
 */
export async function usuarioAutenticado(
  over: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ user: User; token: string; authorization: string; password: string }> {
  const { password, ...dados } = userInput(over)
  const user = await createUserRepository(testDb).create({
    ...dados,
    passwordHash: await testHasher.hash(password),
  })
  const token = testTokens.sign(user.id)
  return { user, token, authorization: bearer(token), password }
}
