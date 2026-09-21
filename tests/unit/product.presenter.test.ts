import { describe, expect, it } from 'vitest'

import { Prisma } from '../../src/generated/pg'
import { toApi } from '../../src/products/product.presenter'

const base = {
  id: 7,
  title: 'Teclado',
  description: 'Switch marrom',
  imageUrl: 'https://cdn.exemplo.com/produtos/teclado.jpg',
  createdAt: new Date('2026-01-10T12:00:00.000Z'),
  updatedAt: new Date('2026-01-11T12:00:00.000Z'),
}

describe('toApi', () => {
  it('formata o preco com duas casas mesmo quando o banco devolve uma', () => {
    // SQLite guarda a coluna DECIMAL com afinidade numerica e devolve 349.9;
    // o Postgres devolve 349.90. A resposta da API tem de ser igual nos dois.
    const umaCasa = toApi({ ...base, price: new Prisma.Decimal('349.9') })
    const duasCasas = toApi({ ...base, price: new Prisma.Decimal('349.90') })

    expect(umaCasa.price).toBe('349.90')
    expect(duasCasas.price).toBe('349.90')
  })

  it('devolve preco como string, nunca como numero de ponto flutuante', () => {
    const dto = toApi({ ...base, price: new Prisma.Decimal('0.10') })
    expect(typeof dto.price).toBe('string')
    expect(dto.price).toBe('0.10')
  })

  it('serializa as datas em ISO 8601', () => {
    const dto = toApi({ ...base, price: new Prisma.Decimal('1.00') })
    expect(dto.createdAt).toBe('2026-01-10T12:00:00.000Z')
    expect(dto.updatedAt).toBe('2026-01-11T12:00:00.000Z')
  })

  it('repassa a imagem sem alterar', () => {
    const dto = toApi({ ...base, price: new Prisma.Decimal('1.00') })
    expect(dto.imageUrl).toBe('https://cdn.exemplo.com/produtos/teclado.jpg')
  })

  it('expoe exatamente os campos do contrato', () => {
    const dto = toApi({ ...base, price: new Prisma.Decimal('1.00') })
    expect(Object.keys(dto).sort()).toEqual([
      'createdAt',
      'description',
      'id',
      'imageUrl',
      'price',
      'title',
      'updatedAt',
    ])
  })
})
