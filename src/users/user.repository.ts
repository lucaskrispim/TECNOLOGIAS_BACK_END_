import type { User } from '../generated/pg'
import type { Db } from '../db/client'
import { ConflictError } from '../http/errors'

export interface UserCreateInput {
  name: string
  email: string
  passwordHash: string
}

export interface UserRepository {
  create(input: UserCreateInput): Promise<User>
  findByEmail(email: string): Promise<User | null>
  findById(id: number): Promise<User | null>
}

/** Codigo do Prisma para violacao de indice unico. */
const VALOR_DUPLICADO = 'P2002'

export function createUserRepository(db: Db): UserRepository {
  return {
    // Nao ha consulta previa por e-mail: o indice unico decide, e assim dois
    // cadastros simultaneos nao passam os dois pela checagem.
    async create(input) {
      try {
        return await db.user.create({ data: input })
      } catch (erro) {
        if (temCodigo(erro, VALOR_DUPLICADO)) throw new ConflictError('email ja cadastrado')
        throw erro
      }
    },

    findByEmail: (email) => db.user.findUnique({ where: { email } }),

    findById: (id) => db.user.findUnique({ where: { id } }),
  }
}

function temCodigo(erro: unknown, codigo: string): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code: unknown }).code === codigo
  )
}
