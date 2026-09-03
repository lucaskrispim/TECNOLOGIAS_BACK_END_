# Plano de desenvolvimento, catálogo em Node, TypeScript, Express e Prisma

Tarefa 1 de Tecnologias Back-End. Enunciado em `Tarefa 1 - Back-End.md`.
Abordagem: teste primeiro (vermelho, verde, refatora), SQLite como banco de
desenvolvimento e de teste, PostgreSQL 15 em Docker como alvo de entrega.

## Por que dois bancos

O enunciado torna obrigatório o PostgreSQL 15 em Docker Compose com volume,
migration inicial aplicada e Prisma Studio. Isso é item de nota e não pode
sair. SQLite entra onde ele ganha: o ciclo de teste roda em milissegundos, sem
container no caminho, e a suíte inteira funciona em outra máquina sem Docker.

A divisão fica assim: SQLite atende os testes automatizados e o desenvolvimento
diário; PostgreSQL atende a demonstração, a migration versionada, o seed final e
o vídeo. O mesmo código de aplicação roda nos dois, com a escolha feita por
variável de ambiente.

## Achados do spike, verificados nesta máquina

Antes de escrever o plano rodei quatro verificações com Prisma 6.19.3 e Node
22.13.1, porque cada uma delas mudaria a arquitetura:

| Verificação | Resultado |
| --- | --- |
| `provider = env("DATABASE_PROVIDER")` no `datasource` | falha na validação, um provider por schema |
| `Decimal` em SQLite | aceito, gera coluna `DECIMAL` |
| `@db.Text` em SQLite | falha na validação, ficar em `String` puro |
| dois clients gerados em pastas distintas | `prisma generate` roda nos dois e o `tsc --strict` compila limpo |

Dois detalhes adicionais que valem para o contrato da API e para os testes. O
`Prisma.Decimal` já serializa como string em `JSON.stringify`, então `res.json`
devolve `"19.99"` e não um número de ponto flutuante, e o teste deve afirmar
sobre a string. E o SQLite guarda a coluna `DECIMAL` com afinidade numérica, o
valor vira `real` por baixo, então garantia de precisão monetária só existe de
fato no Postgres com `@db.Decimal(10, 2)`. Teste de precisão extrema pertence ao
smoke de Postgres da fase 8, não à suíte de SQLite.

## Decisões

O domínio fica sendo produto, como no enunciado, porque você não escolheu tema
do TCC quando perguntei. Trocar depois custa um commit: renomear o modelo, os
campos extras e o seed. As colunas obrigatórias (`id`, `title`, `description`,
`createdAt`, `updatedAt`) e o `price` em `Decimal` permanecem em qualquer tema.

Versões pinadas em Prisma 6.19.3, não 7. O Prisma 7 moveu configuração para
`prisma.config.ts` e mudou a geração do client, o que desalinha do enunciado e
do material da disciplina. Node 22.13.1 via nvm, com `.nvmrc` no projeto, porque
o `node` do PATH desta máquina é v12.22.9 e não roda Prisma nem tsx.

Validação de entrada escrita à mão, em um módulo próprio de umas trinta linhas.
Zod resolveria em cinco, mas o enunciado proíbe framework adicional no back-end
e não vale abrir essa discussão com o professor por tão pouco. Vitest e
Supertest são ferramentas de teste em `devDependencies`, não entram nessa
restrição.

Express 5, que encaminha promise rejeitada direto para o error handler e dispensa
o wrapper `asyncHandler` em cada rota. Se o material da disciplina for Express 4,
a única mudança é acrescentar esse wrapper.

## Estrutura

O projeto nasce em `tarefa1/catalogo-api`, com `git init` próprio, porque a
entrega pede link de repositório público e `pos_web_mobile` é um repositório de
todas as disciplinas.

```
catalogo-api/
  .nvmrc                      Node 22
  .env.example                DATABASE_URL de exemplo, sem segredo real
  docker-compose.yml          Postgres 15, volume, porta 5432
  prisma/
    schema.prisma             fonte da verdade, provider postgresql
    schema.sqlite.prisma      derivado por script, fora do git
    migrations/               migration init, versionada
    seed.ts                   5 ou mais registros reais
  scripts/
    gen-sqlite-schema.mjs     deriva o schema de teste do principal
  src/
    server.ts                 só o listen
    app.ts                    createApp(deps), sem listen, testável
    db/client.ts              escolhe o client por DB_DRIVER
    products/
      product.routes.ts
      product.controller.ts
      product.service.ts
      product.repository.ts
      product.validation.ts
      product.presenter.ts    formata Decimal e datas na resposta
    http/
      errors.ts               AppError, NotFoundError, ValidationError
      error-handler.ts        middleware final, JSON padronizado
    generated/                clients do Prisma, fora do git
  tests/
    unit/                     validação e presenter, sem banco
    integration/              repositório contra SQLite
    http/                     rotas com Supertest, ponta a ponta em SQLite
    support/
      db.ts                   prepara e limpa o SQLite da suíte
      factories.ts            builders de dado de teste
  insomnia/
    catalogo.insomnia.json    workspace exportado
  README.md
```

O `createApp` recebe as dependências por parâmetro e o repositório recebe o
client do Prisma. É o que permite ao teste apontar para SQLite sem tocar em
variável global, e é a mesma separação em camadas que você já usou no trabalho
de Web II.

## Scripts

| Script | Comando | Uso |
| --- | --- | --- |
| `dev` | `tsx watch src/server.ts` | servidor em desenvolvimento |
| `test` | `vitest run` | suíte inteira em SQLite |
| `test:watch` | `vitest` | ciclo vermelho, verde |
| `db:test:prepare` | gera schema sqlite, `prisma db push`, `prisma generate` | pré-requisito da suíte, roda no `pretest` |
| `prisma:migrate` | `prisma migrate dev` | migration contra o Postgres do Docker |
| `prisma:studio` | `prisma studio` | conferência visual dos dados |
| `seed` | `tsx prisma/seed.ts` | popula o banco ativo |
| `typecheck` | `tsc --noEmit` | portão de tipos |

## Ciclo de trabalho

Cada fase começa pelos testes, que devem falhar por ausência de implementação e
não por erro de sintaxe ou de configuração. Só então entra o código mínimo que
faz passar, e a refatoração vem depois, com a suíte verde como rede. Ao fim de
cada fase, `npm test` e `npm run typecheck` passam e há um commit.

Três camadas de teste, com custo crescente. Unitário puro para validação e
formatação de resposta, sem banco nem HTTP. Integração para o repositório contra
SQLite de verdade, que pega erro de query e de mapeamento de tipo. E teste de
rota com Supertest sobre o `app`, que cobre status, corpo e cabeçalho no fluxo
completo. O primeiro nível é onde fica o volume; os outros dois cobrem os
caminhos que importam.

## Fases

### Fase 0, base do projeto e trilhos de teste

Criar o projeto, instalar o mínimo e provar que a infraestrutura de teste
funciona antes de existir qualquer regra de negócio.

Instalar `express`, `@prisma/client` em dependências, e `typescript`, `tsx`,
`vitest`, `supertest`, `prisma`, `@types/node`, `@types/express`,
`@types/supertest` em desenvolvimento. Escrever `tsconfig.json` estrito,
`vitest.config.ts` com `fileParallelism: false` (um arquivo SQLite só, sem
corrida entre workers), `.nvmrc`, `.gitignore` cobrindo `node_modules`, `.env`,
`src/generated`, `prisma/schema.sqlite.prisma` e `*.db`.

Primeiro teste da vida do projeto: um `expect(1 + 1).toBe(2)` em
`tests/unit/smoke.test.ts`, só para ver o Vitest verde. Depois apagar.

Pronto quando `npm test` roda e reporta suíte vazia ou o smoke passando.

### Fase 1, GET / e o primeiro ciclo real

Teste primeiro, em `tests/http/status.test.ts`:

- responde 200 em `GET /`
- corpo é exatamente `{ "status": "ok" }`
- cabeçalho `content-type` é JSON

Implementar `src/app.ts` com `createApp()` devolvendo o app do Express, e
`src/server.ts` chamando `listen` na porta de `PORT`, com 3000 de padrão. O
`server.ts` não é importado por teste nenhum, e é por isso que o `listen` mora
separado.

Pronto quando os três testes passam e `npm run dev` responde no navegador.

### Fase 2, validação de entrada

Ainda sem banco. `tests/unit/product.validation.test.ts` cobre o que entra pelo
corpo da requisição:

- `title` ausente, vazio ou só espaço é rejeitado
- `title` acima de 120 caracteres é rejeitado
- `description` ausente é rejeitada
- `price` ausente, não numérico, negativo ou zero é rejeitado
- `price` com mais de duas casas decimais é rejeitado
- `price` aceita string `"19.90"` e número `19.9`
- payload válido volta normalizado, com `price` em string canônica de duas casas
- campo desconhecido no corpo é ignorado, não vaza para o banco
- o erro traz a lista de campos inválidos, não só a primeira falha

Implementar `product.validation.ts` devolvendo um resultado discriminado
(`{ ok: true, data }` ou `{ ok: false, issues }`), sem lançar exceção. Quem
decide o status HTTP é o controller, não o validador.

O preço sai daqui como string e não como `Prisma.Decimal`, o que mantém a camada
sem dependência do ORM e deixa a conversão para o repositório, que aceita string
em campo `Decimal`.

Pronto quando os nove casos passam.

### Fase 3, repositório contra SQLite

Escrever `prisma/schema.prisma` com o modelo `Product`, o `price` em
`Decimal @db.Decimal(10, 2)` e os dois timestamps. Escrever
`scripts/gen-sqlite-schema.mjs`, que lê esse arquivo, troca o provider por
`sqlite`, troca a pasta de saída do client e remove os atributos `@db.*`. O
schema derivado não vai para o git, é regenerado no `pretest`, e assim não
existe divergência entre os dois.

`tests/support/db.ts` prepara o banco antes da suíte e limpa a tabela antes de
cada teste, para que a ordem dos testes não importe.

`tests/integration/product.repository.test.ts`:

- `create` persiste e devolve `id`, `createdAt` e `updatedAt` preenchidos
- `findAll` devolve lista vazia quando não há registro
- `findAll` devolve os registros na ordem definida, `createdAt` desc
- `findById` devolve o registro existente
- `findById` devolve `null` para id inexistente
- `update` altera o campo e move o `updatedAt` para frente
- `delete` remove e um `findById` seguinte devolve `null`
- `price` volta como `Decimal` e `toString()` preserva as duas casas

Implementar `db/client.ts` e `product.repository.ts`.

Pronto quando os oito testes passam contra um SQLite real.

### Fase 4, leitura pela API

`tests/http/products.read.test.ts`:

- `GET /products` com banco vazio devolve 200 e `[]`
- `GET /products` devolve os registros semeados, com `price` em string
- `GET /products/:id` devolve 200 e o registro certo
- `GET /products/:id` inexistente devolve 404 com `{ error, message }`
- `GET /products/abc` devolve 400, id não numérico não é 404
- `GET /rota-que-nao-existe` devolve 404 em JSON, não HTML do Express

O quinto caso é o que a maioria erra: id não numérico é entrada inválida, e
mandar `NaN` para o Prisma gera erro 500. O quarto e o sexto separam recurso
ausente de rota ausente.

Implementar service, controller, routes e presenter.

Pronto quando os seis testes passam.

### Fase 5, escrita pela API

Os opcionais do enunciado, que rendem nota e são baratos agora que as camadas
existem. `tests/http/products.write.test.ts`:

- `POST /products` válido devolve 201, corpo com `id` e cabeçalho `Location`
- `POST /products` inválido devolve 400 com a lista de campos
- `POST /products` sem `content-type` JSON devolve 400
- `PUT /products/:id` válido devolve 200 com o registro atualizado
- `PUT /products/:id` inexistente devolve 404
- `DELETE /products/:id` devolve 204 com corpo vazio
- `DELETE /products/:id` inexistente devolve 404
- `DELETE` duas vezes seguidas dá 204 e depois 404

Pronto quando os oito testes passam.

### Fase 6, erros centralizados

`tests/http/errors.test.ts`:

- erro inesperado no service vira 500 com JSON, sem stack no corpo
- JSON malformado no corpo vira 400, não 500
- toda resposta de erro tem a mesma forma, `{ error, message, details? }`

Implementar `http/errors.ts` e o `error-handler.ts` como último middleware.
Refatorar controllers para lançar em vez de responder erro na mão.

Pronto quando os três testes passam e nenhum teste anterior quebra.

### Fase 7, seed com dados reais

`prisma/seed.ts` com pelo menos cinco registros plausíveis, preços com duas
casas e descrições de verdade, não `lorem ipsum`. O seed é idempotente, limpa
antes de inserir, para poder rodar duas vezes sem duplicar.

Um teste de integração garante que o seed insere cinco ou mais registros e que
rodá-lo duas vezes não muda a contagem.

Pronto quando `npm run seed` funciona nos dois providers.

### Fase 8, PostgreSQL 15 no Docker e migration

Escrever `docker-compose.yml` com `postgres:15-alpine`, usuário, senha e nome do
banco por variável de ambiente, `5432:5432` e volume nomeado para persistência.
Subir, rodar `npx prisma migrate dev --name init`, rodar o seed e conferir no
`npx prisma studio`.

Smoke manual, que é o que vai para o vídeo: `GET /`, `GET /products`,
`GET /products/:id` com id vindo do seed, e um teste de precisão inserindo
`12345678.99` para ver o `DECIMAL(10, 2)` do Postgres devolver o valor exato.

Derrubar o container e subir de novo, para provar que o volume persiste.

Pronto quando a API responde contra o Postgres, a migration está versionada em
`prisma/migrations` e os dados sobrevivem a um `docker-compose down` sem `-v`.

### Fase 9, Insomnia, README e configuração

Montar o workspace do Insomnia com as três requisições obrigatórias mais as
três de escrita, usando variável de ambiente para a URL base, e exportar para
`insomnia/catalogo.insomnia.json`.

README com o passo a passo que faz a API funcionar do zero em outra máquina:
pré-requisitos com versão de Node, `cp .env.example .env`, subir o Docker,
migration, seed, `npm run dev`, e como rodar os testes sem Docker. Documentar
também o que fazer se a porta 5432 estiver ocupada, o que é comum, e listar os
endpoints com exemplo de requisição e de resposta.

`.env.example` com `DATABASE_URL` de exemplo. O `.env` real fica fora do git.

Pronto quando um clone limpo em outra pasta sobe seguindo só o README.

### Fase 10, entrega

Repositório público no GitHub. Vídeo de 2 a 5 minutos mostrando o código, os
containers ativos, o Prisma Studio com os registros e as chamadas no Insomnia.
Roteiro sugerido: estrutura de pastas e schema em 40 segundos, `docker ps` e
Studio em 40, Insomnia nas três rotas em 60, e `npm test` verde no fim, que é o
diferencial que quase ninguém entrega. Link no SIGAA.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| `node` do PATH é v12 e quebra Prisma e tsx | `.nvmrc` no projeto, `nvm use` antes de qualquer comando, versão mínima no README |
| divergência entre o schema de Postgres e o de SQLite | o de SQLite é derivado por script no `pretest` e fica fora do git |
| precisão monetária não é garantida em SQLite | asserção por string na suíte, teste de precisão no smoke de Postgres |
| porta 5432 ocupada, esta máquina já tem quatro Postgres em container | hoje a 5432 está livre, e o README documenta trocar para 55435 mudando só o mapeamento |
| Prisma 7 mudaria caminho do client e configuração | versão pinada em 6.19.3 no `package.json`, sem `^` |
| `npm error edgesOut`, que apareceu no spike | acontece com `package-lock` sujo, resolve apagando `node_modules` e o lock |
| dois clients gerados aumentam o tempo de `generate` | são menos de dois segundos somados, medido no spike |

## Checklist de entrega

- [ ] `GET /`, `GET /products`, `GET /products/:id` com 404 tratado
- [ ] `POST`, `PUT`, `DELETE` (opcionais do enunciado)
- [ ] `docker-compose.yml` com Postgres 15, variáveis, porta e volume
- [ ] `schema.prisma` com o modelo pedido e `price` em `Decimal`
- [ ] migration `init` criada, aplicada e versionada
- [ ] seed com cinco ou mais registros reais, idempotente
- [ ] `.env` fora do git e `.env.example` dentro
- [ ] scripts `dev`, `seed` e `prisma:migrate` no `package.json`
- [ ] suíte de testes verde, `npm test` sem Docker
- [ ] workspace do Insomnia exportado no repositório
- [ ] README que faz a API subir do zero
- [ ] repositório público e vídeo de 2 a 5 minutos

## Estado da execução, 3 de setembro de 2026

Fases 0 a 9 concluídas em `catalogo-api/`, cada uma com os testes escritos antes
da implementação e um commit próprio. A suíte tem 61 casos, o `tsc --strict`
passa, e um clone limpo instala e roda a suíte sem `.env` e sem Docker.

Três desvios do plano, todos registrados nos commits. O preço sai da validação
como string canônica em vez de `Prisma.Decimal`, o que mantém a camada de
validação livre do ORM. O `parseId` recebe `unknown`, porque o tipo de
`req.params` no Express 5 admite string, array e `undefined`. E a persistência do
volume foi provada derrubando o processo do Postgres e subindo o container de
novo, porque `docker stop` nesta máquina responde `permission denied` com o
Docker instalado por snap.

Falta a fase 10, que depende de você: repositório público no GitHub e o vídeo de
2 a 5 minutos.
