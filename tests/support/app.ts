import type { Express } from 'express'

import { createApp, type AppDeps } from '../../src/app'
import { createAuthService } from '../../src/auth/auth.service'
import { createProductRepository } from '../../src/products/product.repository'
import { createProductService } from '../../src/products/product.service'
import { createUserRepository } from '../../src/users/user.repository'
import { testHasher, testTokens } from './auth'
import { testDb } from './db'

/**
 * Dependencias de producao montadas sobre o SQLite da suite, com o segredo e
 * o custo de bcrypt de teste. Cada teste troca so a peca que quer exercitar.
 */
export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  return {
    products: createProductService(createProductRepository(testDb)),
    auth: createAuthService({
      users: createUserRepository(testDb),
      hasher: testHasher,
      tokens: testTokens,
    }),
    tokens: testTokens,
    ...over,
  }
}

/** App montado sobre o SQLite da suite, com as mesmas camadas de producao. */
export function makeTestApp(over: Partial<AppDeps> = {}): Express {
  return createApp(testDeps(over))
}
