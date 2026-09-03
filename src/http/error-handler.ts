import type { ErrorRequestHandler, RequestHandler } from 'express'

import { AppError, BadRequestError, NotFoundError } from './errors'

/** Ultimo middleware antes do handler de erro: rota que nao existe. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`rota nao encontrada: ${req.method} ${req.path}`))
}

export const errorHandler: ErrorRequestHandler = (erro, _req, res, _next) => {
  const tratado = normalizar(erro)

  if (tratado instanceof AppError) {
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

function normalizar(erro: unknown): unknown {
  if (erro instanceof AppError) return erro
  if (ehJsonMalformado(erro)) return new BadRequestError('corpo da requisicao nao e JSON valido')
  return erro
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
