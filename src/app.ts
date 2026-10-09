import express, { type Express } from 'express'

import { createRequireAuth } from './auth/auth.middleware'
import { createAuthRoutes } from './auth/auth.routes'
import type { AuthService } from './auth/auth.service'
import type { TokenService } from './auth/token'
import { createCorsMiddleware, parseAllowedOrigins } from './http/cors'
import { errorHandler, notFoundHandler } from './http/error-handler'
import { createProductRoutes } from './products/product.routes'
import type { ProductService } from './products/product.service'

export interface AppDeps {
  products: ProductService
  auth: AuthService
  /** Verifica o token do cabecalho Authorization nas rotas protegidas. */
  tokens: TokenService
  /** Origens liberadas no CORS. Sem a lista, vale o que estiver no ambiente. */
  allowedOrigins?: string[]
}

/**
 * Monta a aplicacao Express sem subir servidor, o que permite ao teste
 * exercitar as rotas com Supertest sem abrir porta. As dependencias entram por
 * parametro, e e isso que deixa a suite apontar para o SQLite sem mexer em
 * estado global.
 */
export function createApp(deps: AppDeps): Express {
  const app = express()
  const origens = deps.allowedOrigins ?? parseAllowedOrigins(process.env.ALLOWED_ORIGIN)
  const requireAuth = createRequireAuth(deps.tokens)

  // O CORS vem antes de tudo, para responder ao preflight sem passar pelas
  // rotas nem pelo parser de JSON.
  app.use(createCorsMiddleware(origens))
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', createAuthRoutes(deps.auth, requireAuth))
  app.use('/api/products', createProductRoutes(deps.products, requireAuth))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
