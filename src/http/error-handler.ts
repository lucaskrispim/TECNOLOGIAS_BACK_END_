import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

import {
  AppError,
  BadRequestError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
} from './errors'

/** Codigo do Prisma para operacao sobre registro que nao existe. */
const REGISTRO_NAO_ENCONTRADO = 'P2025'

/** Ultimo middleware antes do handler de erro: rota que nao existe. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`rota nao encontrada: ${req.method} ${req.path}`))
}

export const errorHandler: ErrorRequestHandler = (erro, _req, res, _next) => {
  const tratado = normalizar(erro)

  if (tratado instanceof AppError) {
    // O 401 diz ao cliente qual esquema de autenticacao a API espera.
    if (tratado.status === 401) res.set('WWW-Authenticate', 'Bearer realm="api"')
    res.status(tratado.status).json({
      error: tratado.code,
      message: tratado.message,
      ...(tratado.details === undefined ? {} : { details: tratado.details }),
    })
    return
  }

  // Erro nao previsto: o cliente recebe uma mensagem generica e o stack fica
  // no log do servidor, nunca no corpo da resposta.
  console.error('erro inesperado', erro)
  res.status(500).json({
    error: 'internal_error',
    message: 'erro inesperado ao processar a requisicao',
  })
}

/**
 * Traducao das tres origens de falha que o enunciado separa: ZodError vira
 * 400, o P2025 do Prisma vira 404, e o que sobra cai no 500 generico.
 */
function normalizar(erro: unknown): unknown {
  if (erro instanceof AppError) return erro
  if (erro instanceof ZodError) return new ValidationError(detalhesDoZod(erro))
  if (ehRegistroAusente(erro)) return new NotFoundError()
  if (ehJsonMalformado(erro)) return new BadRequestError('corpo da requisicao nao e JSON valido')
  if (ehCorpoGrandeDemais(erro)) return new PayloadTooLargeError()
  return erro
}

/**
 * Cada issue do Zod vira um par de campo e mensagem, a mesma forma que o
 * cliente ja recebia antes. Issue de objeto inteiro, como a do corpo sem
 * nenhum campo, tem caminho vazio e aparece como body.
 */
function detalhesDoZod(erro: ZodError): { field: string; message: string }[] {
  return erro.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }))
}

/**
 * A checagem olha o campo `code` em vez de usar instanceof: cada schema do
 * Prisma gera o seu proprio runtime, e a classe de erro do client de SQLite
 * nao e a mesma do client de Postgres.
 */
function ehRegistroAusente(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code: unknown }).code === REGISTRO_NAO_ENCONTRADO
  )
}

/** express.json rejeita corpo invalido com um SyntaxError marcado com status 400. */
function ehJsonMalformado(erro: unknown): boolean {
  return (
    erro instanceof SyntaxError &&
    'status' in erro &&
    (erro as { status: unknown }).status === 400 &&
    'body' in erro
  )
}

/** express.json recusa corpo acima do limite (100 kB) com erro de tipo proprio. */
function ehCorpoGrandeDemais(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'type' in erro &&
    (erro as { type: unknown }).type === 'entity.too.large'
  )
}
