/**
 * Validacao de entrada escrita a mao. O enunciado proibe framework adicional
 * no back-end, e a camada nao depende do Prisma: o preco sai daqui como string
 * canonica de duas casas, e quem converte para Decimal e o repositorio. Assim
 * o teste desta camada e puro, sem banco e sem ORM.
 */

export interface ProductInput {
  title: string
  description: string
  price: string
}

export interface ValidationIssue {
  field: string
  message: string
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; issues: ValidationIssue[] }

const TITLE_MAX = 120
const DESCRIPTION_MAX = 2000

/** Maior valor que cabe em DECIMAL(10,2), o tipo da coluna no Postgres. */
const PRICE_MAX = '99999999.99'

export function validateProductInput(body: unknown): ValidationResult<ProductInput> {
  if (!isPlainObject(body)) {
    return { ok: false, issues: [{ field: 'body', message: 'o corpo deve ser um objeto JSON' }] }
  }

  const issues: ValidationIssue[] = []
  const title = takeText(body.title, 'title', TITLE_MAX, issues)
  const description = takeText(body.description, 'description', DESCRIPTION_MAX, issues)
  const price = takePrice(body.price, issues)

  if (title === null || description === null || price === null) {
    return { ok: false, issues }
  }

  // Somente estes tres campos seguem adiante, entao campo desconhecido no
  // corpo da requisicao nao chega ao banco.
  return { ok: true, data: { title, description, price } }
}

function takeText(
  raw: unknown,
  field: string,
  max: number,
  issues: ValidationIssue[],
): string | null {
  if (typeof raw !== 'string') {
    issues.push({ field, message: `${field} e obrigatorio e deve ser texto` })
    return null
  }

  const value = raw.trim()
  if (value.length === 0) {
    issues.push({ field, message: `${field} nao pode ser vazio` })
    return null
  }
  if (value.length > max) {
    issues.push({ field, message: `${field} deve ter no maximo ${max} caracteres` })
    return null
  }

  return value
}

function takePrice(raw: unknown, issues: ValidationIssue[]): string | null {
  const reject = (message: string) => {
    issues.push({ field: 'price', message })
    return null
  }

  let texto: string
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return reject('price deve ser um numero finito')
    texto = String(raw)
  } else if (typeof raw === 'string') {
    texto = raw.trim()
  } else {
    return reject('price e obrigatorio e deve ser numero ou string numerica')
  }

  // Notacao cientifica e separador de milhar ficam de fora de proposito: o
  // valor tem de vir em forma decimal simples.
  const partes = /^(?<sinal>-?)(?<inteiro>\d+)(?:\.(?<decimais>\d+))?$/.exec(texto)
  if (!partes) return reject('price deve ser um valor decimal, por exemplo 19.90')

  // O regex tem grupos nomeados, entao groups existe sempre que ele casa.
  const { sinal, inteiro, decimais = '' } = partes.groups as {
    sinal: string
    inteiro: string
    decimais?: string
  }
  if (decimais.length > 2) return reject('price deve ter no maximo duas casas decimais')

  const valor = `${inteiro}.${decimais.padEnd(2, '0')}`
  if (sinal === '-' || isZero(valor)) return reject('price deve ser maior que zero')
  if (compareDecimal(valor, PRICE_MAX) > 0) {
    return reject(`price deve ser no maximo ${PRICE_MAX}`)
  }

  return stripLeadingZeros(valor)
}

function isZero(valor: string): boolean {
  return /^0+\.0{2}$/.test(valor)
}

/**
 * Compara duas strings decimais de duas casas sem passar por ponto flutuante,
 * que e justamente o que o enunciado pede para evitar em dinheiro.
 */
function compareDecimal(a: string, b: string): number {
  const [ai = '', ad = ''] = a.split('.')
  const [bi = '', bd = ''] = b.split('.')
  const largura = Math.max(ai.length, bi.length)
  const esquerda = ai.padStart(largura, '0') + ad
  const direita = bi.padStart(largura, '0') + bd
  if (esquerda === direita) return 0
  return esquerda < direita ? -1 : 1
}

function stripLeadingZeros(valor: string): string {
  return valor.replace(/^0+(?=\d)/, '')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
