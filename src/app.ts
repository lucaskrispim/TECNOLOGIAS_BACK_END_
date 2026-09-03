import express, { type Express } from 'express'

import { errorHandler, notFoundHandler } from './http/error-handler'
import { createProductRoutes } from './products/product.routes'
import type { ProductService } from './products/product.service'

export interface AppDeps {
  products: ProductService
}

/**
 * Monta a aplicacao Express sem subir servidor, o que permite ao teste
 * exercitar as rotas com Supertest sem abrir porta. As dependencias entram por
 * parametro, e e isso que deixa a suite apontar para o SQLite sem mexer em
 * estado global.
 */
export function createApp(deps: AppDeps): Express {
  const app = express()

  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/products', createProductRoutes(deps.products))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
