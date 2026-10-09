import { Router, type RequestHandler } from 'express'

import { createAuthController } from './auth.controller'
import type { AuthService } from './auth.service'

export function createAuthRoutes(service: AuthService, requireAuth: RequestHandler): Router {
  const controller = createAuthController(service)
  const router = Router()

  router.post('/register', controller.register)
  router.post('/login', controller.login)
  router.get('/me', requireAuth, controller.me)

  return router
}
