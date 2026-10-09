import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A colecao do Insomnia e parte da entrega. Este teste garante que ela cobre
 * cada cenario que o enunciado lista, para que uma edicao da colecao nao
 * apague um caso sem ninguem notar.
 */
interface Recurso {
  _type: string
  _id: string
  name?: string
  method?: string
  url?: string
  headers?: { name: string; value: string }[]
  body?: { text?: string }
  data?: Record<string, string>
}

const colecao = JSON.parse(
  readFileSync(resolve(__dirname, '../../insomnia/catalogo-auth.insomnia.json'), 'utf8'),
) as { __export_format: number; resources: Recurso[] }

const requests = colecao.resources.filter((r) => r._type === 'request')

function temAuth(r: Recurso): boolean {
  return (r.headers ?? []).some((h) => h.name.toLowerCase() === 'authorization')
}

function achar(metodo: string, sufixo: string, comAuth?: boolean): Recurso[] {
  return requests.filter(
    (r) =>
      r.method === metodo &&
      (r.url ?? '').replace(/\{\{[^}]+\}\}/g, ':v').endsWith(sufixo) &&
      (comAuth === undefined || temAuth(r) === comAuth),
  )
}

describe('colecao do Insomnia da tarefa 3', () => {
  it('esta no formato de exportacao 4', () => {
    expect(colecao.__export_format).toBe(4)
  })

  it('tem registro valido e invalido', () => {
    expect(achar('POST', '/api/auth/register').length).toBeGreaterThanOrEqual(2)
  })

  it('tem login valido e invalido', () => {
    expect(achar('POST', '/api/auth/login').length).toBeGreaterThanOrEqual(2)
  })

  it('tem /auth/me com e sem token', () => {
    expect(achar('GET', '/api/auth/me', true)).not.toHaveLength(0)
    expect(achar('GET', '/api/auth/me', false)).not.toHaveLength(0)
  })

  it('tem POST, PUT e DELETE de products com e sem token', () => {
    for (const [metodo, sufixo] of [
      ['POST', '/api/products'],
      ['PUT', '/api/products/:v'],
      ['DELETE', '/api/products/:v'],
    ] as const) {
      expect(achar(metodo, sufixo, true), `${metodo} com token`).not.toHaveLength(0)
      expect(achar(metodo, sufixo, false), `${metodo} sem token`).not.toHaveLength(0)
    }
  })

  it('o token, valido ou invalido, vem de variavel de ambiente, nunca colado na requisicao', () => {
    for (const r of requests.filter(temAuth)) {
      const valor = (r.headers ?? []).find((h) => h.name.toLowerCase() === 'authorization')?.value
      expect(valor, r.name).toMatch(/^Bearer \{\{ ?_\.token(_invalido)? ?\}\}$/)
    }
  })

  it('todo corpo JSON da colecao e JSON valido', () => {
    for (const r of requests.filter((x) => x.body?.text)) {
      expect(() => JSON.parse(r.body?.text ?? ''), r.name).not.toThrow()
    }
  })
})
