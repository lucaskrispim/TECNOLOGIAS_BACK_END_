import { PrismaClient } from '../../src/generated/sqlite'
import type { Db } from '../../src/db/client'

/**
 * Client de SQLite da suite. O schema e o banco sao preparados por
 * `npm run db:test:prepare`, que roda no pretest, entao aqui basta conectar.
 *
 * O cast existe porque cada schema do Prisma gera o seu proprio client, e os
 * dois tipos sao identicos em forma mas distintos em nome. A aplicacao e
 * tipada contra o client de Postgres, que e o alvo de producao.
 */
const client = new PrismaClient()

export const testDb = client as unknown as Db

export async function resetDb(): Promise<void> {
  await client.product.deleteMany()
  await client.user.deleteMany()
}

export async function disconnectDb(): Promise<void> {
  await client.$disconnect()
}

export function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
