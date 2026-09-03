import { describe, expect, it } from 'vitest'

import { validateProductInput } from '../../src/products/product.validation'

const valido = { title: 'Teclado mecanico', description: 'Switch marrom', price: '349.90' }

function issues(body: unknown): string[] {
  const res = validateProductInput(body)
  if (res.ok) return []
  return res.issues.map((i) => i.field)
}

describe('validateProductInput, titulo', () => {
  it('rejeita titulo ausente', () => {
    const { title, ...semTitulo } = valido
    expect(issues(semTitulo)).toContain('title')
  })

  it('rejeita titulo vazio ou so com espaco', () => {
    expect(issues({ ...valido, title: '' })).toContain('title')
    expect(issues({ ...valido, title: '   ' })).toContain('title')
  })

  it('rejeita titulo acima de 120 caracteres', () => {
    expect(issues({ ...valido, title: 'a'.repeat(121) })).toContain('title')
    expect(issues({ ...valido, title: 'a'.repeat(120) })).not.toContain('title')
  })

  it('remove espaco das pontas do titulo', () => {
    const res = validateProductInput({ ...valido, title: '  Mouse  ' })
    expect(res.ok && res.data.title).toBe('Mouse')
  })
})

describe('validateProductInput, descricao', () => {
  it('rejeita descricao ausente ou vazia', () => {
    const { description, ...semDescricao } = valido
    expect(issues(semDescricao)).toContain('description')
    expect(issues({ ...valido, description: '  ' })).toContain('description')
  })
})

describe('validateProductInput, preco', () => {
  it('rejeita preco ausente', () => {
    const { price, ...semPreco } = valido
    expect(issues(semPreco)).toContain('price')
  })

  it('rejeita preco nao numerico', () => {
    expect(issues({ ...valido, price: 'abc' })).toContain('price')
    expect(issues({ ...valido, price: '' })).toContain('price')
    expect(issues({ ...valido, price: true })).toContain('price')
    expect(issues({ ...valido, price: Number.NaN })).toContain('price')
    expect(issues({ ...valido, price: Number.POSITIVE_INFINITY })).toContain('price')
  })

  it('rejeita preco negativo ou zero', () => {
    expect(issues({ ...valido, price: '-1.00' })).toContain('price')
    expect(issues({ ...valido, price: 0 })).toContain('price')
  })

  it('rejeita preco com mais de duas casas decimais', () => {
    expect(issues({ ...valido, price: '19.999' })).toContain('price')
    expect(issues({ ...valido, price: 19.999 })).toContain('price')
  })

  it('rejeita preco acima do que DECIMAL(10,2) guarda', () => {
    expect(issues({ ...valido, price: '99999999.99' })).not.toContain('price')
    expect(issues({ ...valido, price: '100000000.00' })).toContain('price')
  })

  it('aceita preco em string e em numero, e normaliza para duas casas', () => {
    const emString = validateProductInput({ ...valido, price: '19.90' })
    const emNumero = validateProductInput({ ...valido, price: 19.9 })
    const inteiro = validateProductInput({ ...valido, price: 20 })
    expect(emString.ok && emString.data.price).toBe('19.90')
    expect(emNumero.ok && emNumero.data.price).toBe('19.90')
    expect(inteiro.ok && inteiro.data.price).toBe('20.00')
  })
})

describe('validateProductInput, contrato do resultado', () => {
  it('payload valido volta normalizado, com exatamente os campos do modelo', () => {
    const res = validateProductInput(valido)
    expect(res.ok).toBe(true)
    expect(res.ok && Object.keys(res.data).sort()).toEqual(['description', 'price', 'title'])
  })

  it('ignora campo desconhecido, que nao pode vazar para o banco', () => {
    const res = validateProductInput({ ...valido, id: 99, createdAt: 'ontem', admin: true })
    expect(res.ok && Object.keys(res.data).sort()).toEqual(['description', 'price', 'title'])
  })

  it('acusa todos os campos invalidos de uma vez, nao so o primeiro', () => {
    const res = validateProductInput({ title: '', description: '', price: 'x' })
    expect(res.ok).toBe(false)
    expect(issues({ title: '', description: '', price: 'x' }).sort()).toEqual([
      'description',
      'price',
      'title',
    ])
    expect(res.ok === false && res.issues.every((i) => i.message.length > 0)).toBe(true)
  })

  it('rejeita corpo que nao e objeto', () => {
    expect(validateProductInput(null).ok).toBe(false)
    expect(validateProductInput('texto').ok).toBe(false)
    expect(validateProductInput([]).ok).toBe(false)
  })
})
