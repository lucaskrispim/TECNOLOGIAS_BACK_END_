import type { RequestHandler } from 'express'

import { toApi } from '../users/user.presenter'
import { authenticatedUserId } from './auth.middleware'
import { loginSchema, registerSchema } from './auth.schema'
import type { AuthService } from './auth.service'

export interface AuthController {
  register: RequestHandler
  login: RequestHandler
  me: RequestHandler
}

export function createAuthController(service: AuthService): AuthController {
  return {
    register: async (req, res) => {
      const { user, token } = await service.register(registerSchema.parse(req.body))
      res.status(201).location('/api/auth/me').json({ user: toApi(user), token })
    },

    login: async (req, res) => {
      const { user, token } = await service.login(loginSchema.parse(req.body))
      res.json({ user: toApi(user), token })
    },

    me: async (_req, res) => {
      const user = await service.me(authenticatedUserId(res))
      res.json({ user: toApi(user) })
    },
  }
}
