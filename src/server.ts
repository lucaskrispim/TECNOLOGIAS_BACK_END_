import { createApp } from './app'
import { loadAuthConfig } from './auth/auth.config'
import { createAuthService } from './auth/auth.service'
import { createPasswordHasher } from './auth/password'
import { createTokenService } from './auth/token'
import { createDbClient, currentDriver } from './db/client'
import { parseAllowedOrigins } from './http/cors'
import { createProductRepository } from './products/product.repository'
import { createProductService } from './products/product.service'
import { createUserRepository } from './users/user.repository'

// Carrega o .env da raiz sem sobrescrever o que ja estiver no ambiente. Sem o
// arquivo, como em container com variaveis injetadas, segue com o ambiente.
try {
  process.loadEnvFile()
} catch {
  // sem .env: vale o ambiente do processo
}

const port = Number(process.env.PORT ?? 3000)
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGIN)
// Le a configuracao antes de abrir conexao: sem JWT_SECRET a API nem sobe.
const authConfig = loadAuthConfig(process.env)
const db = createDbClient()
const tokens = createTokenService(authConfig)
const app = createApp({
  products: createProductService(createProductRepository(db)),
  auth: createAuthService({
    users: createUserRepository(db),
    hasher: createPasswordHasher(authConfig.bcryptRounds),
    tokens,
  }),
  tokens,
  allowedOrigins,
})

const server = app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port} (banco: ${currentDriver()})`)
  console.log(`CORS liberado para: ${allowedOrigins.join(', ')}`)
  console.log(`JWT com expiracao de ${authConfig.expiresIn}`)
})

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0))
    })
  })
}
