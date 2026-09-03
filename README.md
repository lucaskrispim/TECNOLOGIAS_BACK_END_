# Catalogo de produtos, API em Node, TypeScript, Express e Prisma

Tarefa 1 da disciplina de Tecnologias Back-End. API REST que persiste um
catalogo de produtos em PostgreSQL 15 rodando em container, com Prisma para
modelagem, migration e seed.

O projeto foi escrito com teste primeiro: cada rota nasceu de um teste que
falhava antes de existir implementacao. A suite tem 61 casos e roda em SQLite,
sem depender de Docker, o que deixa `npm test` funcionar em qualquer maquina.

## Requisitos

| Ferramenta | Versao | Observacao |
| --- | --- | --- |
| Node.js | 20 ou superior | testado em 22.13.1. Ha um `.nvmrc`, entao `nvm use` resolve |
| npm | 10 ou superior | vem com o Node 20 |
| Docker | qualquer versao recente | so para o banco |
| Docker Compose | v2 ou superior | `docker compose` ou `docker-compose` |

## Como rodar do zero

```bash
git clone <url-do-repositorio>
cd catalogo-api

nvm use                  # ou garanta Node 20+ no PATH
npm install              # gera os clients do Prisma no postinstall

cp .env.example .env     # ajuste usuario, senha e portas se quiser

docker compose up -d     # sobe o PostgreSQL 15 (ou docker-compose up -d)
npm run prisma:migrate   # cria a tabela products
npm run seed             # grava os seis produtos iniciais

npm run dev              # API em http://localhost:3000
```

Conferindo:

```bash
curl http://localhost:3000/
curl http://localhost:3000/products
curl http://localhost:3000/products/1
```

Para ver os dados numa interface, `npm run prisma:studio` abre o Prisma Studio
em http://localhost:5555.

## Endpoints

| Metodo | Rota | Resposta |
| --- | --- | --- |
| GET | `/` | 200 com `{"status":"ok"}` |
| GET | `/products` | 200 com a lista, do mais recente para o mais antigo |
| GET | `/products/:id` | 200 com o produto, 404 se nao existir, 400 se o id nao for inteiro positivo |
| POST | `/products` | 201 com o produto criado e cabecalho `Location`, 400 se o corpo for invalido |
| PUT | `/products/:id` | 200 com o produto atualizado, 404 se nao existir, 400 se o corpo for invalido |
| DELETE | `/products/:id` | 204 sem corpo, 404 se nao existir |

Exemplo de criacao:

```bash
curl -X POST http://localhost:3000/products \
  -H 'content-type: application/json' \
  -d '{
    "title": "Webcam Full HD 1080p",
    "description": "Webcam com foco automatico e microfone estereo.",
    "price": "319.90"
  }'
```

Resposta:

```json
{
  "id": 7,
  "title": "Webcam Full HD 1080p",
  "description": "Webcam com foco automatico e microfone estereo.",
  "price": "319.90",
  "createdAt": "2026-09-03T14:38:09.018Z",
  "updatedAt": "2026-09-03T14:38:09.018Z"
}
```

O preco vai e volta como string. Numero de ponto flutuante em JSON perderia
centavo, e a coluna no banco e `numeric(10,2)`. O campo aceita string ou numero
na entrada, sempre com no maximo duas casas decimais, e sai normalizado com
duas casas.

## Contrato de erro

Toda resposta de erro tem a mesma forma, com `details` presente apenas quando ha
lista de campos:

```json
{
  "error": "validation_error",
  "message": "corpo da requisicao invalido",
  "details": [
    { "field": "title", "message": "title nao pode ser vazio" },
    { "field": "price", "message": "price deve ser um valor decimal, por exemplo 19.90" }
  ]
}
```

| Situacao | Status | `error` |
| --- | --- | --- |
| corpo invalido | 400 | `validation_error` |
| id fora do formato, JSON malformado | 400 | `bad_request` |
| produto ou rota inexistente | 404 | `not_found` |
| falha nao prevista | 500 | `internal_error` |

O 500 devolve mensagem generica: stack e mensagem interna ficam no log do
servidor, nunca no corpo da resposta.

## Testes com o Insomnia

O arquivo `insomnia/catalogo.insomnia.json` traz nove requisicoes prontas,
incluindo os casos de 404 e de 400. Para usar, importe em
`Application`, `Preferences`, `Data`, `Import Data`, `From File`.

O ambiente da colecao tem duas variaveis, `base_url` e `id_valido`. Se a API
subir em outra porta, mude apenas `base_url`.

## Testes automatizados

```bash
npm test          # 61 casos, nao precisa de Docker
npm run test:watch
npm run typecheck
```

A suite tem tres niveis. Os unitarios cobrem validacao de entrada, formatacao
da resposta e parsing de id, sem banco e sem HTTP. Os de integracao exercitam o
repositorio e o seed contra um SQLite de verdade, o que pega erro de query e de
mapeamento de tipo. Os de rota sobem o app com Supertest e verificam status,
corpo e cabecalho no fluxo completo.

O `pretest` prepara o banco de teste sozinho, entao nao ha passo manual antes
de rodar.

`npm run test:coverage` gera o relatorio de cobertura em `coverage/`. O numero
atual e 100% de linhas, instrucoes, ramos e funcoes, com piso verificado pelo
proprio Vitest. Os detalhes, o que cada nivel garante e o que fica de fora estao
em [TESTES.md](TESTES.md).

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor com recarga automatica |
| `npm run build` e `npm start` | compila para `dist/` e roda o compilado |
| `npm test` | suite completa em SQLite |
| `npm run test:coverage` | suite com relatorio de cobertura em `coverage/` |
| `npm run typecheck` | `tsc --noEmit` com `strict` ligado |
| `npm run prisma:migrate` | cria e aplica migration no Postgres |
| `npm run prisma:studio` | abre o Prisma Studio |
| `npm run seed` | popula o banco com os seis produtos |
| `npm run generate:all` | regera os dois clients do Prisma |
| `npm run db:test:prepare` | deriva o schema de SQLite e sincroniza o banco de teste |

## Estrutura

```
prisma/
  schema.prisma        modelo, provider postgresql, fonte da verdade
  migrations/          migration init versionada
  seed.ts              casca de linha de comando do seed
scripts/
  gen-sqlite-schema.mjs  deriva o schema de teste do principal
src/
  app.ts               monta o Express, recebe as dependencias por parametro
  server.ts            unico lugar que chama listen
  db/client.ts         escolhe o client conforme DB_DRIVER
  http/                erros, middleware de erro e parsing de parametro
  products/            rota, controller, service, repositorio, validacao, presenter, seed
tests/
  unit/                validacao, presenter e parsing, sem banco
  integration/         repositorio e seed contra SQLite
  http/                rotas com Supertest
  support/             app de teste, controle do banco e factories
insomnia/              workspace exportado
```

As dependencias entram por parametro: `createApp` recebe o service, e o
repositorio recebe o client do Prisma. E isso que permite a suite apontar para
SQLite e injetar um service que falha, para exercitar o caminho de erro, sem
mexer em estado global.

## Dois bancos, e por que

PostgreSQL 15 em container e o banco da aplicacao, com migration versionada e
volume nomeado. SQLite atende a suite de testes, que assim roda em
milissegundos e sem Docker.

O Prisma aceita um provider por schema, e `provider = env("DATABASE_PROVIDER")`
nao passa na validacao. Em vez de manter dois schemas na mao, que divergem na
primeira alteracao de modelo, `prisma/schema.sqlite.prisma` e derivado de
`prisma/schema.prisma` por `scripts/gen-sqlite-schema.mjs`, roda no `pretest` e
fica fora do git. Se alguma substituicao do script deixar de casar, ele falha em
vez de gerar um banco de teste que nao corresponde ao de producao.

Para rodar a propria aplicacao em SQLite, por exemplo sem Docker disponivel:

```bash
npm run db:test:prepare
DB_DRIVER=sqlite npm run seed
DB_DRIVER=sqlite npm run dev
```

Uma diferenca vale registrar. O SQLite guarda a coluna `DECIMAL` com afinidade
numerica e devolve `349.9`, enquanto o Postgres devolve `349.90`. O presenter
uniformiza com duas casas, e por isso a resposta da API e identica nos dois. A
garantia de precisao de centavo, porem, so existe de fato no Postgres.

## Problemas comuns

**Porta 5432 ocupada.** Mude `POSTGRES_PORT` no `.env` para 55435, e ajuste a
porta na `DATABASE_URL` para a mesma. O compose usa essa variavel no mapeamento.

**Porta 3000 ocupada.** Defina `PORT=3333` no `.env` e ajuste `base_url` no
ambiente do Insomnia.

**`prisma` ou `tsx` falha com erro de sintaxe.** Node antigo no PATH. Rode
`node -v`: precisa ser 20 ou superior. Com nvm, `nvm use` le o `.nvmrc`.

**`npm error edgesOut` durante a instalacao.** Lock ou cache sujo. Apague
`node_modules` e `package-lock.json` e instale de novo.

**`docker stop` responde `permission denied`.** Acontece com o Docker instalado
pelo pacote snap. Use `sudo docker compose down`.

**Erro `Environment variable not found: DATABASE_URL`.** Falta o `.env`. Rode
`cp .env.example .env`.
