import { Router } from 'express'

import { createProductController } from './product.controller'
import type { ProductService } from './product.service'

export function createProductRoutes(service: ProductService): Router {
  const controller = createProductController(service)
  const router = Router()

  router.get('/', controller.index)
  router.get('/:id', controller.show)
  router.post('/', controller.store)
  router.put('/:id', controller.update)
  router.delete('/:id', controller.destroy)

  return router
}
