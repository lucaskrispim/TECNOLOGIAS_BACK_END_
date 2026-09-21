import cors, { type CorsOptions } from 'cors'
import type { RequestHandler } from 'express'

/** Porta padrao do Vite, onde o front de desenvolvimento roda. */
export const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:5173'

/** Verbos do CRUD, mais o OPTIONS que o navegador usa no preflight. */
export const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']

/** A API so troca JSON, entao Content-Type basta na lista de cabecalhos. */
export const ALLOWED_HEADERS = ['Content-Type']

/**
 * Le ALLOWED_ORIGIN, que aceita uma origem ou varias separadas por virgula.
 * Sem a variavel, cai no front de desenvolvimento: a lista nunca fica vazia,
 * e nao existe caminho que libere qualquer origem por engano.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  const origens = (raw ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter((origem) => origem.length > 0)

  return origens.length > 0 ? origens : [DEFAULT_ALLOWED_ORIGIN]
}

/**
 * Politica restritiva por lista fixa. Requisicao sem Origin, como a do
 * Insomnia ou do curl, passa: o cabecalho so existe em chamada de navegador,
 * e e o navegador quem barra a leitura da resposta quando a origem nao consta.
 */
export function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
  const options: CorsOptions = {
    origin: (origin, done) => {
      done(null, origin === undefined || allowedOrigins.includes(origin))
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    optionsSuccessStatus: 204,
  }

  return cors(options)
}
