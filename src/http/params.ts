import { BadRequestError } from './errors'

/**
 * Converte parametro de rota em id. Id fora do formato e entrada invalida, e
 * responde 400: mandar NaN para o banco viraria erro 500, e responder 404
 * confundiria recurso ausente com pedido malformado.
 *
 * O parametro entra como unknown porque o tipo de req.params no Express 5
 * admite string, array de string e undefined.
 */
export function parseId(raw: unknown, nome = 'id'): number {
  const invalido = new BadRequestError(`${nome} deve ser um numero inteiro positivo`)

  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) throw invalido

  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) throw invalido

  return id
}
