import { createApp } from './app'
import { createDbClient, currentDriver } from './db/client'
import { parseAllowedOrigins } from './http/cors'
import { createProductRepository } from './products/product.repository'
import { createProductService } from './products/product.service'

const port = Number(process.env.PORT ?? 3000)
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGIN)
const db = createDbClient()
const app = createApp({
  products: createProductService(createProductRepository(db)),
  allowedOrigins,
})

const server = app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port} (banco: ${currentDriver()})`)
  console.log(`CORS liberado para: ${allowedOrigins.join(', ')}`)
})

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0))
    })
  })
}
