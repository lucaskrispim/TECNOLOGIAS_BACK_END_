import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'

import { createProductSchema, updateProductSchema } from '../../src/products/product.schema'

const valido = {
  title: 'Teclado mecanico',
  description: 'Teclado com switch marrom e layout brasileiro.',
  price: '349.90',
  imageUrl: 'https://cdn.exemplo.com/produtos/teclado.jpg',
}

/** Campos acusados pelo schema, na ordem em que o Zod os reporta. */
function campos(schema: ZodType, body: unknown): string[] {
  const res = schema.safeParse(body)
  return res.success ? [] : res.error.issues.map((i) => String(i.path[0] ?? 'body'))
}

function dados(schema: ZodType, body: unknown): Record<string, unknown> {
  const res = schema.safeParse(body)
  if (!res.success) throw new Error(`esperava payload valido: ${res.error.message}`)
  return res.data as Record<string, unknown>
}

describe('createProductSchema, titulo', () => {
  it('rejeita titulo ausente, vazio ou com menos de tres caracteres', () => {
    const { title, ...semTitulo } = valido
    expect(campos(createProductSchema, semTitulo)).toContain('title')
    expect(campos(createProductSchema, { ...valido, title: '' })).toContain('title')
    expect(campos(createProductSchema, { ...valido, title: 'ab' })).toContain('title')
  })

  it('aceita titulo com exatamente tres caracteres', () => {
    expect(campos(createProductSchema, { ...valido, title: 'Mou' })).not.toContain('title')
  })

  it('conta o titulo depois de remover espaco das pontas', () => {
    expect(campos(createProductSchema, { ...valido, title: '  ab  ' })).toContain('title')
    expect(dados(createProductSchema, { ...valido, title: '  Mouse  ' }).title).toBe('Mouse')
  })

  it('rejeita titulo acima de 120 caracteres, o limite da coluna', () => {
    expect(campos(createProductSchema, { ...valido, title: 'a'.repeat(121) })).toContain('title')
    expect(campos(createProductSchema, { ...valido, title: 'a'.repeat(120) })).not.toContain('title')
  })

  it('rejeita titulo que nao e texto', () => {
    expect(campos(createProductSchema, { ...valido, title: 42 })).toContain('title')
  })
})

describe('createProductSchema, descricao', () => {
  it('rejeita descricao com menos de dez caracteres', () => {
    expect(campos(createProductSchema, { ...valido, description: 'curta' })).toContain('description')
    expect(campos(createProductSchema, { ...valido, description: 'a'.repeat(10) })).not.toContain(
      'description',
    )
  })

  it('rejeita descricao ausente ou so com espaco', () => {
    const { description, ...semDescricao } = valido
    expect(campos(createProductSchema, semDescricao)).toContain('description')
    expect(campos(createProductSchema, { ...valido, description: ' '.repeat(20) })).toContain(
      'description',
    )
  })
})

describe('createProductSchema, imageUrl', () => {
  it('rejeita imageUrl ausente ou vazia', () => {
    const { imageUrl, ...semImagem } = valido
    expect(campos(createProductSchema, semImagem)).toContain('imageUrl')
    expect(campos(createProductSchema, { ...valido, imageUrl: '' })).toContain('imageUrl')
    expect(campos(createProductSchema, { ...valido, imageUrl: '   ' })).toContain('imageUrl')
  })

  it('aceita caminho relativo, nao so url absoluta', () => {
    expect(dados(createProductSchema, { ...valido, imageUrl: '/img/teclado.jpg' }).imageUrl).toBe(
      '/img/teclado.jpg',
    )
  })
})

describe('createProductSchema, preco', () => {
  it('rejeita preco ausente ou de tipo errado', () => {
    const { price, ...semPreco } = valido
    expect(campos(createProductSchema, semPreco)).toContain('price')
    expect(campos(createProductSchema, { ...valido, price: true })).toContain('price')
    expect(campos(createProductSchema, { ...valido, price: null })).toContain('price')
  })

  it('rejeita preco nao numerico', () => {
    for (const price of ['abc', '', '1e3', '1.000,50']) {
      expect(campos(createProductSchema, { ...valido, price }), price).toContain('price')
    }
  })

  it('rejeita preco negativo ou zero', () => {
    for (const price of ['-1.00', -0.01, 0, '0.00']) {
      expect(campos(createProductSchema, { ...valido, price }), String(price)).toContain('price')
    }
  })

  it('rejeita numero nao finito', () => {
    expect(campos(createProductSchema, { ...valido, price: Number.NaN })).toContain('price')
    expect(campos(createProductSchema, { ...valido, price: Number.POSITIVE_INFINITY })).toContain(
      'price',
    )
  })

  it('rejeita preco com mais de duas casas decimais', () => {
    expect(campos(createProductSchema, { ...valido, price: '19.999' })).toContain('price')
    expect(campos(createProductSchema, { ...valido, price: 19.999 })).toContain('price')
  })

  it('rejeita preco acima do que DECIMAL(10,2) guarda', () => {
    expect(campos(createProductSchema, { ...valido, price: '99999999.99' })).not.toContain('price')
    expect(campos(createProductSchema, { ...valido, price: '100000000.00' })).toContain('price')
  })

  it('aceita string e numero, e normaliza para string de duas casas', () => {
    expect(dados(createProductSchema, { ...valido, price: '19.9' }).price).toBe('19.90')
    expect(dados(createProductSchema, { ...valido, price: 19.9 }).price).toBe('19.90')
    expect(dados(createProductSchema, { ...valido, price: 20 }).price).toBe('20.00')
    expect(dados(createProductSchema, { ...valido, price: ' 07.5 ' }).price).toBe('7.50')
  })
})

describe('createProductSchema, contrato do resultado', () => {
  it('payload valido sai com exatamente os campos do modelo', () => {
    expect(Object.keys(dados(createProductSchema, valido)).sort()).toEqual([
      'description',
      'imageUrl',
      'price',
      'title',
    ])
  })

  it('descarta campo desconhecido, que nao pode vazar para o banco', () => {
    const saida = dados(createProductSchema, { ...valido, id: 99, createdAt: 'ontem', admin: true })
    expect(Object.keys(saida).sort()).toEqual(['description', 'imageUrl', 'price', 'title'])
  })

  it('acusa todos os campos invalidos de uma vez, nao so o primeiro', () => {
    const invalido = { title: '', description: '', price: 'x', imageUrl: '' }
    expect(campos(createProductSchema, invalido).sort()).toEqual([
      'description',
      'imageUrl',
      'price',
      'title',
    ])
  })

  it('toda mensagem de erro e legivel e cita o limite violado', () => {
    const res = createProductSchema.safeParse({ ...valido, title: 'ab', description: 'curta' })
    expect(res.success).toBe(false)
    if (res.success) return

    const porCampo = new Map(res.error.issues.map((i) => [String(i.path[0]), i.message]))
    expect(porCampo.get('title')).toMatch(/3/)
    expect(porCampo.get('description')).toMatch(/10/)
    for (const mensagem of porCampo.values()) expect(mensagem.length).toBeGreaterThan(0)
  })

  it('rejeita corpo que nao e objeto', () => {
    for (const body of [null, 'texto', [], 42]) {
      expect(createProductSchema.safeParse(body).success, String(body)).toBe(false)
    }
  })
})

describe('updateProductSchema, atualizacao parcial', () => {
  it('aceita um unico campo', () => {
    expect(dados(updateProductSchema, { title: 'So o titulo novo' })).toEqual({
      title: 'So o titulo novo',
    })
    expect(dados(updateProductSchema, { price: 10 })).toEqual({ price: '10.00' })
  })

  it('aplica as mesmas regras do schema de criacao no campo enviado', () => {
    expect(campos(updateProductSchema, { title: 'ab' })).toContain('title')
    expect(campos(updateProductSchema, { description: 'curta' })).toContain('description')
    expect(campos(updateProductSchema, { price: '-5.00' })).toContain('price')
    expect(campos(updateProductSchema, { imageUrl: '' })).toContain('imageUrl')
  })

  it('rejeita corpo sem nenhum campo conhecido, que nao tem o que atualizar', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false)
    expect(updateProductSchema.safeParse({ campoQualquer: 1 }).success).toBe(false)
  })

  it('aceita o payload completo, entao PUT total continua valendo', () => {
    expect(Object.keys(dados(updateProductSchema, valido)).sort()).toEqual([
      'description',
      'imageUrl',
      'price',
      'title',
    ])
  })
})
