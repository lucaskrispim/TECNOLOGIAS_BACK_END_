import type { PrismaClient as PgPrismaClient } from '../generated/pg'

/**
 * Tipo do client em toda a aplicacao. A tipagem segue o client de Postgres,
 * que e o alvo de producao; o client de SQLite tem a mesma forma e entra por
 * cast onde e usado.
 */
export type Db = PgPrismaClient

export type DbDriver = 'postgresql' | 'sqlite'

export function currentDriver(): DbDriver {
  return process.env.DB_DRIVER === 'sqlite' ? 'sqlite' : 'postgresql'
}

/**
 * O client de SQLite entra por require dentro do ramo, e nao por import no
 * topo do arquivo, para que rodar em Postgres nao carregue o segundo engine do
 * Prisma na memoria.
 */
export function createDbClient(driver: DbDriver = currentDriver()): Db {
  if (driver === 'sqlite') {
    const { PrismaClient } = require('../generated/sqlite') as typeof import('../generated/sqlite')
    return new PrismaClient() as unknown as Db
  }

  const { PrismaClient } = require('../generated/pg') as typeof import('../generated/pg')
  return new PrismaClient()
}
