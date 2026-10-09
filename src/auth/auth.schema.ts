/**
 * Contrato de entrada de registro e login, validado em tempo de execucao.
 *
 * O e-mail e aparado e passado para minusculas antes da checagem de formato,
 * de modo que Ana@Exemplo.com e ana@exemplo.com sao a mesma conta. A senha
 * nunca e aparada: espaco faz parte dela.
 */

import { z } from 'zod'

export const NAME_MIN = 2
export const NAME_MAX = 120
export const EMAIL_MAX = 254
export const PASSWORD_MIN = 6

/** O bcrypt so le os primeiros 72 bytes; o que vier depois seria ignorado em silencio. */
export const PASSWORD_MAX_BYTES = 72

const email = z
  .string({ error: 'email e obrigatorio e deve ser texto' })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, `email deve ter no maximo ${EMAIL_MAX} caracteres`)
  .pipe(z.email({ error: 'email invalido' }))

function senha(min: number, mensagemMinimo: string) {
  return z
    .string({ error: 'password e obrigatorio e deve ser texto' })
    .min(min, mensagemMinimo)
    .refine((valor) => Buffer.byteLength(valor, 'utf8') <= PASSWORD_MAX_BYTES, {
      error: `password deve ter no maximo ${PASSWORD_MAX_BYTES} bytes`,
    })
}

export const registerSchema = z.object({
  name: z
    .string({ error: 'name e obrigatorio e deve ser texto' })
    .trim()
    .min(NAME_MIN, `name deve ter no minimo ${NAME_MIN} caracteres`)
    .max(NAME_MAX, `name deve ter no maximo ${NAME_MAX} caracteres`),
  email,
  password: senha(PASSWORD_MIN, `password deve ter no minimo ${PASSWORD_MIN} caracteres`),
})

/**
 * No login o minimo de 6 nao se aplica: a regra e de cadastro, e quem errar a
 * senha recebe 401 pela comparacao, nao 400 pela forma.
 */
export const loginSchema = z.object({
  email,
  password: senha(1, 'password nao pode ser vazio'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
