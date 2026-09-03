import { describe, expect, it } from 'vitest'

import { BadRequestError } from '../../src/http/errors'
import { parseId } from '../../src/http/params'

describe('parseId', () => {
  it('aceita inteiro positivo em string', () => {
    expect(parseId('7')).toBe(7)
    expect(parseId(' 42 ')).toBe(42)
  })

  it('rejeita o que nao e inteiro positivo', () => {
    for (const entrada of ['abc', '1.5', '-3', '0', '', '  ', undefined, ['1'], 7, null]) {
      expect(() => parseId(entrada), String(entrada)).toThrow(BadRequestError)
    }
  })

  it('rejeita numero acima do inteiro seguro', () => {
    expect(() => parseId('9007199254740993')).toThrow(BadRequestError)
  })
})
