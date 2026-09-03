// Deriva prisma/schema.sqlite.prisma de prisma/schema.prisma.
//
// Existe porque o Prisma aceita um unico provider por schema: a linha
// `provider = env("DATABASE_PROVIDER")` nao passa na validacao. Em vez de
// manter dois schemas na mao, que divergem na primeira alteracao de modelo, o
// de SQLite e gerado a cada `npm test` e fica fora do git.
//
// Cada substituicao e obrigatoria. Se o schema principal mudar de forma que uma
// delas deixe de casar, o script falha em vez de gerar um banco de teste que
// nao corresponde ao de producao.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const origem = resolve(raiz, 'prisma/schema.prisma')
const destino = resolve(raiz, 'prisma/schema.sqlite.prisma')

const substituicoes = [
  {
    de: /output   = "\.\.\/src\/generated\/pg"/,
    para: 'output   = "../src/generated/sqlite"',
    motivo: 'pasta de saida do client',
  },
  {
    de: /provider = "postgresql"/,
    para: 'provider = "sqlite"',
    motivo: 'provider do datasource',
  },
  {
    // Caminho literal em vez de env: a suite roda em clone limpo, sem .env.
    de: /url      = env\("DATABASE_URL"\)/,
    para: 'url      = "file:./test.db"',
    motivo: 'url do datasource',
  },
]

let schema = readFileSync(origem, 'utf8')

for (const { de, para, motivo } of substituicoes) {
  if (!de.test(schema)) {
    console.error(`gen-sqlite-schema: nao encontrei a ${motivo} em prisma/schema.prisma`)
    process.exit(1)
  }
  schema = schema.replace(de, para)
}

// SQLite nao aceita atributos nativos como @db.Decimal(10, 2) ou @db.VarChar.
// O tipo Decimal em si funciona, e o que sai e so a anotacao de precisao.
const semAtributosNativos = schema.replace(/ +@db\.[A-Za-z]+(\([^)]*\))?/g, '')

const cabecalho = [
  '// ARQUIVO GERADO por scripts/gen-sqlite-schema.mjs. Nao edite.',
  '// Fonte: prisma/schema.prisma. Regenerado a cada npm test.',
  '',
].join('\n')

writeFileSync(destino, cabecalho + semAtributosNativos)
console.log('gen-sqlite-schema: prisma/schema.sqlite.prisma gerado')
