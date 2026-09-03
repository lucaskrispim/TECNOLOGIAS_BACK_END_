import type { Express } from 'express'

import { createApp } from '../../src/app'
import { createProductRepository } from '../../src/products/product.repository'
import { createProductService } from '../../src/products/product.service'
import { testDb } from './db'

/** App montado sobre o SQLite da suite, com as mesmas camadas de producao. */
export function makeTestApp(): Express {
  return createApp({ products: createProductService(createProductRepository(testDb)) })
}
