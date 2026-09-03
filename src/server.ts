import { createApp } from './app'
import { createDbClient, currentDriver } from './db/client'
import { createProductRepository } from './products/product.repository'
import { createProductService } from './products/product.service'

const port = Number(process.env.PORT ?? 3000)
const db = createDbClient()
const app = createApp({ products: createProductService(createProductRepository(db)) })

const server = app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port} (banco: ${currentDriver()})`)
})

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0))
    })
  })
}
