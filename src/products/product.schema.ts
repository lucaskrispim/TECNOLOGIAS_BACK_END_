/**
 * Contrato de entrada da API, validado em tempo de execucao pelo Zod.
 *
 * A camada nao conhece o Prisma: o preco sai daqui como string canonica de
 * duas casas, e quem converte para Decimal e o repositorio. Assim o teste
 * desta camada e puro, sem banco e sem ORM.
 */

import { z } from 'zod'

const TITLE_MIN = 3
const TITLE_MAX = 120
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000
const IMAGE_URL_MAX = 2048

/** Maior valor que cabe em DECIMAL(10,2), o tipo da coluna no Postgres. */
const PRICE_MAX = '99999999.99'

function texto(campo: string, min: number, max: number) {
  const minimo =
    min === 1 ? `${campo} nao pode ser vazio` : `${campo} deve ter no minimo ${min} caracteres`

  return z
    .string({ error: `${campo} e obrigatorio e deve ser texto` })
    .trim()
    .min(min, minimo)
    .max(max, `${campo} deve ter no maximo ${max} caracteres`)
}

/**
 * Preco entra como numero ou como string decimal e sai sempre como string de
 * duas casas. A comparacao com o teto e feita sobre texto, sem passar por
 * ponto flutuante, que e justamente o que se evita no caminho do dinheiro.
 */
const price = z
  // z.number() ja recusa NaN e infinito, entao o transform so cuida da forma
  // decimal e dos limites da coluna.
  .union([z.string(), z.number()], {
    error: 'price e obrigatorio e deve ser numero ou string numerica',
  })
  .transform((raw, ctx) => {
    const recusar = (message: string) => {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }

    // Notacao cientifica e separador de milhar ficam de fora de proposito: o
    // valor tem de vir em forma decimal simples.
    const bruto = typeof raw === 'number' ? String(raw) : raw.trim()
    const partes = /^(?<sinal>-?)(?<inteiro>\d+)(?:\.(?<decimais>\d+))?$/.exec(bruto)
    if (!partes) return recusar('price deve ser um valor decimal, por exemplo 19.90')

    // O regex tem grupos nomeados, entao groups existe sempre que ele casa.
    const { sinal, inteiro, decimais = '' } = partes.groups as {
      sinal: string
      inteiro: string
      decimais?: string
    }
    if (decimais.length > 2) return recusar('price deve ter no maximo duas casas decimais')

    const valor = `${inteiro}.${decimais.padEnd(2, '0')}`
    if (sinal === '-' || /^0+\.0{2}$/.test(valor)) return recusar('price deve ser maior que zero')
    if (compararDecimal(valor, PRICE_MAX) > 0) {
      return recusar(`price deve ser no maximo ${PRICE_MAX}`)
    }

    return valor.replace(/^0+(?=\d)/, '')
  })

/**
 * Schema de criacao. O Zod descarta campo desconhecido por padrao, entao nada
 * fora destes quatro chega ao banco.
 */
export const createProductSchema = z.object({
  title: texto('title', TITLE_MIN, TITLE_MAX),
  description: texto('description', DESCRIPTION_MIN, DESCRIPTION_MAX),
  imageUrl: texto('imageUrl', 1, IMAGE_URL_MAX),
  price,
})

/**
 * Schema de atualizacao: o de criacao em versao parcial, com as mesmas regras
 * por campo. Corpo sem nenhum campo conhecido e recusado, porque um PUT que
 * nao muda nada e pedido malformado, nao sucesso vazio.
 */
export const updateProductSchema = createProductSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    error: 'informe ao menos um campo para atualizar',
  })

export type ProductCreateInput = z.infer<typeof createProductSchema>
export type ProductUpdateInput = z.infer<typeof updateProductSchema>

/** Compara duas strings decimais de duas casas sem passar por ponto flutuante. */
function compararDecimal(a: string, b: string): number {
  const [ai = '', ad = ''] = a.split('.')
  const [bi = '', bd = ''] = b.split('.')
  const largura = Math.max(ai.length, bi.length)
  const esquerda = ai.padStart(largura, '0') + ad
  const direita = bi.padStart(largura, '0') + bd
  if (esquerda === direita) return 0
  return esquerda < direita ? -1 : 1
}
