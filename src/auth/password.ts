import bcrypt from 'bcrypt'

export interface PasswordHasher {
  hash(plain: string): Promise<string>
  compare(plain: string, hash: string): Promise<boolean>
}

/**
 * O custo entra por parametro: 10 em producao, 4 na suite, que verifica o
 * fluxo e nao a resistencia do hash.
 */
export function createPasswordHasher(rounds: number): PasswordHasher {
  return {
    hash: (plain) => bcrypt.hash(plain, rounds),

    // Com hash corrompido o bcrypt devolve false em vez de lancar, e o teste
    // de unidade fixa esse comportamento: o login responde 401, nao 500.
    compare: (plain, hash) => bcrypt.compare(plain, hash),
  }
}
