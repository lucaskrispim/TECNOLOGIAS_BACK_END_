import { Router, type RequestHandler } from 'express'

import { createProductController } from './product.controller'
import type { ProductService } from './product.service'

/**
 * Leitura publica, escrita autenticada. O requireAuth fica antes do handler,
 * entao pedido sem token recebe 401 antes de qualquer validacao de corpo ou de
 * id: quem nao se identificou nao fica sabendo se o pedido estava bem formado.
 */
export function createProductRoutes(service: ProductService, requireAuth: RequestHandler): Router {
  const controller = createProductController(service)
  const router = Router()

  router.get('/', controller.index)
  router.get('/:id', controller.show)
  router.post('/', requireAuth, controller.store)
  router.put('/:id', requireAuth, controller.update)
  router.delete('/:id', requireAuth, controller.destroy)

  return router
}
