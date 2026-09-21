# Catalogo de produtos, API em Node, TypeScript, Express e Prisma

Tarefas 1 e 2 da disciplina de Tecnologias Back-End. API REST que persiste um
catalogo de produtos em PostgreSQL 15 rodando em container, com Prisma para
modelagem, migration e seed.

A tarefa 2 acrescentou o CRUD completo sob o prefixo `/api`, validacao de
runtime com Zod, CORS restrito ao front de desenvolvimento e o campo `imageUrl`
no modelo.

O projeto foi escrito com teste primeiro: cada rota nasceu de um teste que
falhava antes de existir implementacao. A suite tem 107 casos e roda em SQLite,
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
curl http://localhost:3000/api/products
curl http://localhost:3000/api/products/1
```

Para ver os dados numa interface, `npm run prisma:studio` abre o Prisma Studio
em http://localhost:5555.

## Endpoints

| Metodo | Rota | Resposta |
| --- | --- | --- |
| GET | `/` | 200 com `{"status":"ok"}` |
| GET | `/api/products` | 200 com a lista, do mais recente para o mais antigo |
| GET | `/api/products/:id` | 200 com o produto, 404 se nao existir, 400 se o id nao for inteiro positivo |
| POST | `/api/products` | 201 com o produto criado e cabecalho `Location`, 400 se o corpo for invalido |
| PUT | `/api/products/:id` | 200 com o produto atualizado, 404 se nao existir, 400 se o corpo for invalido |
| DELETE | `/api/products/:id` | 204 sem corpo, 404 se nao existir |

O `PUT` e parcial: manda so o que muda. O corpo passa pelo schema de criacao em
versao `.partial()`, entao enviar o objeto inteiro tambem funciona. Corpo sem
nenhum campo conhecido responde 400, porque atualizacao que nao altera nada e
pedido malformado.

Exemplo de criacao:

```bash
curl -X POST http://localhost:3000/api/products \
  -H 'content-type: application/json' \
  -d '{
    "title": "Webcam Full HD 1080p",
    "description": "Webcam com foco automatico e microfone estereo.",
    "price": "319.90",
    "imageUrl": "https://picsum.photos/seed/webcam/640/480"
  }'
```

Resposta:

```json
{
  "id": 7,
  "title": "Webcam Full HD 1080p",
  "description": "Webcam com foco automatico e microfone estereo.",
  "imageUrl": "https://picsum.photos/seed/webcam/640/480",
  "price": "319.90",
  "createdAt": "2026-09-03T14:38:09.018Z",
  "updatedAt": "2026-09-03T14:38:09.018Z"
}
```

Atualizacao de um campo so:

```bash
curl -X PUT http://localhost:3000/api/products/7 \
  -H 'content-type: application/json' \
  -d '{ "price": "289.90" }'
```

O preco vai e volta como string. Numero de ponto flutuante em JSON perderia
centavo, e a coluna no banco e `numeric(10,2)`. O campo aceita string ou numero
na entrada, sempre com no maximo duas casas decimais, e sai normalizado com
duas casas.

## Validacao com Zod

O corpo da requisicao passa por um schema de runtime antes de chegar ao banco,
em `src/products/product.schema.ts`:

| Campo | Regra |
| --- | --- |
| `title` | texto de 3 a 120 caracteres, contados depois de aparar as pontas |
| `description` | texto de 10 a 2000 caracteres |
| `imageUrl` | texto nao vazio, ate 2048 caracteres. Aceita url absoluta ou caminho relativo |
| `price` | numero ou string decimal, maior que zero, no maximo duas casas, teto de 99999999.99 |

O schema de atualizacao e o mesmo em versao `.partial()`, entao as regras por
campo valem igual no `PUT`.

Tres coisas o Zod resolve aqui. Campo desconhecido no corpo e descartado, e nao
chega ao `data` do Prisma. O erro traz todos os campos invalidos de uma vez, e
nao so o primeiro. E o preco sai do schema ja como string canonica de duas
casas, entao o repositorio recebe sempre a mesma forma, venha o valor como
`19.9`, `"19.90"` ou `19.90`.

Os handlers chamam `parse`, nao `safeParse`: o `ZodError` sobe e o middleware de
erro decide o status. E ali, em `src/http/error-handler.ts`, que as tres origens
de falha se separam: `ZodError` vira 400, o codigo `P2025` do Prisma vira 404 e
o resto cai no 500 generico.

## CORS

O middleware `cors` entra antes das rotas e antes do parser de JSON, para
responder ao preflight sem custo. A politica:

| Item | Valor | Por que |
| --- | --- | --- |
| origens | `ALLOWED_ORIGIN`, ou `http://localhost:5173` quando a variavel falta | lista fixa, conferida por igualdade. Nao existe curinga nem reflexo automatico da origem que chamou |
| metodos | `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS` | os verbos do CRUD, mais o preflight |
| cabecalhos | `Content-Type` | a API so troca JSON, entao nao ha o que liberar alem disso |
| credenciais | desligadas | a API nao usa cookie nem sessao |

`ALLOWED_ORIGIN` aceita varias origens separadas por virgula, util quando o
front tambem roda em outra porta ou ja tem endereco de producao.

Requisicao sem `Origin`, como a do Insomnia e a do curl, e atendida
normalmente. O cabecalho so existe em chamada de navegador, e e o navegador
quem barra a leitura da resposta quando a origem nao consta na lista. Por isso
a chamada de origem estranha nao vira 403 no servidor: ela recebe a resposta
sem `Access-Control-Allow-Origin`, e o navegador a descarta.

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

| Situacao | Status | `error` | Origem |
| --- | --- | --- | --- |
| corpo invalido | 400 | `validation_error` | `ZodError` |
| id fora do formato, JSON malformado | 400 | `bad_request` | `parseId` e o parser do Express |
| produto ou rota inexistente | 404 | `not_found` | `P2025` do Prisma, ou rota sem handler |
| falha nao prevista | 500 | `internal_error` | qualquer outra excecao |

O 500 devolve mensagem generica: stack e mensagem interna ficam no log do
servidor, nunca no corpo da resposta.

## Testes com o Insomnia

O arquivo `insomnia/catalogo.insomnia.json` traz quinze requisicoes prontas,
cobrindo o caminho feliz e os erros de cada rota. Cada uma registra na
descricao o status esperado. Para usar, importe em `Application`,
`Preferences`, `Data`, `Import Data`, `From File`.

| Requisicao | Esperado |
| --- | --- |
| `GET /` | 200 |
| `GET /api/products` | 200 |
| `GET /api/products/:id` existente, inexistente, fora do formato | 200, 404, 400 |
| `POST /api/products` valido, invalido | 201, 400 |
| `PUT /api/products/:id` parcial, completo, preco negativo, id inexistente | 200, 200, 400, 404 |
| `DELETE /api/products/:id` valido, inexistente | 204, 404 |
| `OPTIONS /api/products/:id` origem liberada, origem estranha | 204 com `Access-Control-Allow-Origin`, resposta sem o cabecalho |

O ambiente da colecao tem tres variaveis: `base_url`, `id_valido` e
`id_removivel`. Aponte as duas ultimas para ids que existam no banco, e deixe
`id_removivel` num registro descartavel, por exemplo o que o `POST` acabou de
criar. Se a API subir em outra porta, mude apenas `base_url`.

Ha tambem `insomnia/catalogo-urls-fixas-3333.insomnia.json`, com as mesmas
requisicoes e a URL escrita em cada uma, para o caso de a importacao das
variaveis de ambiente falhar em alguma versao do Insomnia.

## Testes automatizados

```bash
npm test          # 107 casos, nao precisa de Docker
npm run test:watch
npm run typecheck
```

A suite tem tres niveis. Os unitarios cobrem os schemas do Zod, a formatacao da
resposta e o parsing de id, sem banco e sem HTTP. Os de integracao exercitam o
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
  http/                cors, erros, middleware de erro e parsing de parametro
  products/            rota, controller, service, repositorio, schema Zod, presenter, seed
tests/
  unit/                schema, presenter e parsing, sem banco
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
ambiente do Insomnia, ou importe o workspace de URLs fixas, que ja aponta para
a 3333.

**O front recebe erro de CORS no navegador.** A origem dele nao esta em
`ALLOWED_ORIGIN`. Ponha o endereco exato, com esquema e porta, e reinicie a
API: ao subir, ela imprime as origens liberadas.

**`prisma` ou `tsx` falha com erro de sintaxe.** Node antigo no PATH. Rode
`node -v`: precisa ser 20 ou superior. Com nvm, `nvm use` le o `.nvmrc`.

**`npm error edgesOut` durante a instalacao.** Lock ou cache sujo. Apague
`node_modules` e `package-lock.json` e instale de novo.

**`docker stop` responde `permission denied`.** Acontece com o Docker instalado
pelo pacote snap. Use `sudo docker compose down`.

**Erro `Environment variable not found: DATABASE_URL`.** Falta o `.env`. Rode
`cp .env.example .env`.
