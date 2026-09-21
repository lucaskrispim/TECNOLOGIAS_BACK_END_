import type { RequestHandler } from 'express'

import { parseId } from '../http/params'
import { toApi } from './product.presenter'
import { createProductSchema, updateProductSchema } from './product.schema'
import type { ProductService } from './product.service'

export interface ProductController {
  index: RequestHandler
  show: RequestHandler
  store: RequestHandler
  update: RequestHandler
  destroy: RequestHandler
}

/**
 * Os handlers usam parse, nao safeParse: o ZodError sobe e o middleware de
 * erro o traduz em 400 com a lista de campos. Assim o controller fica com o
 * caminho feliz, e a decisao de status mora num lugar so.
 */
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
      const criado = await service.create(createProductSchema.parse(req.body))
      res.status(201).location(`/api/products/${criado.id}`).json(toApi(criado))
    },

    update: async (req, res) => {
      // O id e o corpo sao validados antes de qualquer acesso ao banco.
      const id = parseId(req.params.id)
      const atualizado = await service.update(id, updateProductSchema.parse(req.body))
      res.json(toApi(atualizado))
    },

    destroy: async (req, res) => {
      await service.remove(parseId(req.params.id))
      res.status(204).end()
    },
  }
}
