/**
 * Configuracao de autenticacao lida do ambiente. Recebe o ambiente por
 * parametro para que o teste nao precise mexer em process.env.
 *
 * Falha na subida em vez de cair num padrao: um JWT_SECRET ausente ou curto
 * permitiria a qualquer um forjar token, e e melhor a API nao subir do que
 * subir aberta.
 */

export const JWT_SECRET_MIN = 32
export const DEFAULT_JWT_EXPIRES_IN = '7d'
export const DEFAULT_BCRYPT_ROUNDS = 10

const BCRYPT_ROUNDS_MIN = 4
const BCRYPT_ROUNDS_MAX = 15

/** Inteiro positivo, sozinho em segundos ou com unidade, como o jsonwebtoken le. */
const DURACAO = /^[1-9]\d*[smhdwy]?$/

export interface AuthConfig {
  secret: string
  expiresIn: string
  bcryptRounds: number
}

export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const secret = (env.JWT_SECRET ?? '').trim()
  if (secret.length === 0) {
    throw new Error('JWT_SECRET nao definido: copie o .env.example para .env e preencha')
  }
  if (secret.length < JWT_SECRET_MIN) {
    throw new Error(`JWT_SECRET deve ter no minimo ${JWT_SECRET_MIN} caracteres`)
  }

  const expiresIn = valorOuPadrao(env.JWT_EXPIRES_IN, DEFAULT_JWT_EXPIRES_IN)
  if (!DURACAO.test(expiresIn)) {
    throw new Error(`JWT_EXPIRES_IN invalido: ${expiresIn}. Use, por exemplo, 7d, 12h ou 3600`)
  }

  const rodadas = valorOuPadrao(env.BCRYPT_ROUNDS, String(DEFAULT_BCRYPT_ROUNDS))
  const bcryptRounds = Number(rodadas)
  if (
    !/^\d+$/.test(rodadas) ||
    bcryptRounds < BCRYPT_ROUNDS_MIN ||
    bcryptRounds > BCRYPT_ROUNDS_MAX
  ) {
    throw new Error(
      `BCRYPT_ROUNDS deve ser inteiro de ${BCRYPT_ROUNDS_MIN} a ${BCRYPT_ROUNDS_MAX}, veio ${rodadas}`,
    )
  }

  return { secret, expiresIn, bcryptRounds }
}

function valorOuPadrao(valor: string | undefined, padrao: string): string {
  const aparado = (valor ?? '').trim()
  return aparado.length > 0 ? aparado : padrao
}
