import type { RequestHandler } from 'express'

import { ValidationError } from '../http/errors'
import { parseId } from '../http/params'
import { toApi } from './product.presenter'
import type { ProductService } from './product.service'
import { type ProductInput, validateProductInput } from './product.validation'

export interface ProductController {
  index: RequestHandler
  show: RequestHandler
  store: RequestHandler
  update: RequestHandler
  destroy: RequestHandler
}

export function createProductController(service: ProductService): ProductController {
  return {
    index: async (_req, res) => {
      const produtos = await service.list()
      res.json(produtos.map(toApi))
    },

    show: async (req, res) => {
      const produto = await service.get(parseId(req.params.id))
      res.json(toApi(produto))
    },

    store: async (req, res) => {
      const criado = await service.create(corpoValidado(req.body))
      res.status(201).location(`/products/${criado.id}`).json(toApi(criado))
    },

    update: async (req, res) => {
      // O id e o corpo sao validados antes de qualquer acesso ao banco.
      const id = parseId(req.params.id)
      const atualizado = await service.replace(id, corpoValidado(req.body))
      res.json(toApi(atualizado))
    },

    destroy: async (req, res) => {
      await service.remove(parseId(req.params.id))
      res.status(204).end()
    },
  }
}

/**
 * Traduz falha de validacao em erro HTTP. O validador nao lanca de proposito,
 * para poder ser testado sem HTTP, e a decisao do status fica aqui.
 */
function corpoValidado(body: unknown): ProductInput {
  const resultado = validateProductInput(body)
  if (!resultado.ok) throw new ValidationError(resultado.issues)
  return resultado.data
}
