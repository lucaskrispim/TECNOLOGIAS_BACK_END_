// Entrada do seed pela linha de comando: npm run seed.
//
// A regra de povoamento fica em src/products/product.seed.ts, que a suite de
// testes exercita contra SQLite. Aqui e so a casca que abre o client, roda e
// fecha a conexao.

import { createDbClient, currentDriver } from '../src/db/client'
import { PRODUTOS_INICIAIS, seedProducts } from '../src/products/product.seed'

async function main(): Promise<void> {
  const db = createDbClient()

  try {
    const inseridos = await seedProducts(db)
    console.log(`seed: ${inseridos} de ${PRODUTOS_INICIAIS.length} produtos gravados (banco: ${currentDriver()})`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((erro) => {
  console.error('seed falhou', erro)
  process.exit(1)
})
