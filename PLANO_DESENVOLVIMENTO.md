# Plano de desenvolvimento, catálogo em Node, TypeScript, Express e Prisma

Tarefa 1 de Tecnologias Back-End. Enunciado em `Tarefa 1 - Back-End.md`.
Abordagem: teste primeiro (vermelho, verde, refatora), SQLite como banco de
desenvolvimento e de teste, PostgreSQL 15 em Docker como alvo de entrega.

A tarefa 2 continua neste mesmo documento, a partir da seção
[Tarefa 2, CRUD completo com Zod e CORS](#tarefa-2-crud-completo-com-zod-e-cors).
O plano vira diário: cada parte tem suas fases, seus riscos e o estado da
execução ao fim.

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

## Tarefa 2, CRUD completo com Zod e CORS

Enunciado em `Tarefa 2 - Back-end.md`. A base continua a mesma: Node, Express 5,
Prisma sobre PostgreSQL 15 em container, suíte em SQLite, teste antes da
implementação. O que entra é validação de runtime com Zod, CORS restrito ao
front, prefixo `/api`, atualização parcial no `PUT` e o campo `imageUrl` no
modelo.

### O que muda, e o que fica como está

| Item | Tarefa 1 | Tarefa 2 |
| --- | --- | --- |
| validação | módulo escrito à mão, resultado discriminado | schemas Zod, `parse` no controller |
| rotas | `/products` | `/api/products`, sem alias para o caminho antigo |
| `PUT` | substituição, exige os três campos | atualização parcial com `.partial()` |
| modelo | `title`, `description`, `price` | mais `imageUrl`, obrigatório |
| CORS | ausente | lista fixa vinda de `ALLOWED_ORIGIN` |
| tratamento de erro | `AppError` traduzido no middleware | mais `ZodError` para 400 e `P2025` para 404 |

Ficam intactos a arquitetura em camadas, a injeção de dependência no
`createApp`, o presenter que uniformiza `Decimal` e datas, os dois schemas de
Prisma derivados por script, e o contrato de erro `{ error, message, details? }`,
que o front já consegue consumir sem tratar formato por status.

### Decisões da tarefa 2

Zod entra e a validação manual sai. Na tarefa 1 escrevi o validador à mão porque
o enunciado proibia framework adicional; o enunciado novo exige Zod nominalmente,
então a proibição caiu e manter as duas camadas só criaria duas fontes de
verdade para a mesma regra. Os casos de borda que o módulo antigo cobria migram
para o teste do schema, não se perdem: preço negativo, mais de duas casas, teto
de `numeric(10,2)`, campo desconhecido descartado.

O prefixo `/api` substitui o caminho antigo em vez de conviver com ele. Duas
rotas para o mesmo recurso é dívida imediata: o Insomnia fica com requisições
duplicadas e o próximo leitor não sabe qual é a boa.

`imageUrl` é obrigatório na criação, como o enunciado pede, e obrigatório também
na coluna. Coluna anulável com schema exigente é o pior dos dois mundos: o banco
aceita registro sem imagem e o front quebra ao renderizar o card. Como a tabela
já tinha registros, a migration adiciona a coluna com valor padrão vazio e retira
o padrão em seguida, e o `npm run seed` repovoa com as imagens.

O `PUT` parcial recusa corpo vazio. `.partial()` sozinho aceitaria `{}` e
responderia 200 sem alterar nada, o que engana o cliente; um `.refine` cobra pelo
menos um campo conhecido e devolve 400.

O `P2025` do Prisma é tratado em dois lugares, de propósito. O repositório já o
traduz em ausência de registro, que é onde a informação faz sentido, e o
middleware repete a tradução como rede de segurança para o caso de ele escapar
de uma consulta nova. Código diferente de `P2025` continua subindo para virar
500, em vez de um 404 enganoso.

CORS por lista fixa, conferida por igualdade, sem curinga e sem refletir a origem
que chamou. Origem de fora da lista não vira 403: a requisição é atendida e a
resposta sai sem `Access-Control-Allow-Origin`, que é o mecanismo real do
navegador. Fingir bloqueio no servidor daria falsa sensação de segurança, já que
curl e Insomnia passam de qualquer jeito.

### Fases

#### Fase 11, schemas em Zod

Teste primeiro, em `tests/unit/product.schema.test.ts`, cobrindo cada regra do
enunciado e os limites exatos: `title` de 3 a 120 caracteres contados depois de
aparar as pontas, `description` a partir de 10, `imageUrl` não vazia, `price`
maior que zero com no máximo duas casas e teto de `99999999.99`. Mais o contrato
de saída: campo desconhecido descartado, todos os campos inválidos acusados de
uma vez, corpo que não é objeto recusado. E o schema parcial: um campo só,
mesmas regras por campo, corpo vazio recusado.

Implementar `src/products/product.schema.ts` com `createProductSchema` e
`updateProductSchema`. O preço sai do schema como string canônica de duas casas,
igual à tarefa 1, para que o repositório receba sempre a mesma forma e a camada
siga sem dependência do ORM.

Apagar `product.validation.ts` e o teste dele.

Pronto quando os casos do schema passam e nada mais importa o módulo antigo.

#### Fase 12, imagem no modelo

Acrescentar `imageUrl String @db.VarChar(2048)` ao `Product`, atualizar as
factories de teste e os seis registros do seed, e criar a migration com
`prisma migrate dev --create-only`, editando o SQL para o padrão temporário.
Aplicar com `prisma migrate deploy`, que não oferece reset e portanto não
arrisca os dados de desenvolvimento.

Pronto quando a suíte passa, o seed grava as imagens e a coluna aparece no
Prisma Studio.

#### Fase 13, prefixo e atualização parcial

Testes de rota reescritos para `/api/products`, mais um caso afirmando que o
caminho antigo responde 404. No `PUT`, o caso central é enviar só um campo e
confirmar, lendo o registro depois, que os demais ficaram como estavam.

Implementar a montagem do router em `/api/products`, o `Location` apontando para
o caminho novo, e `service.update` recebendo patch parcial no lugar do antigo
`replace`.

Pronto quando os testes de leitura e de escrita passam.

#### Fase 14, CORS

`tests/http/cors.test.ts` cobre o que o servidor envia: origem da lista recebe
`Access-Control-Allow-Origin`, origem de fora não recebe, preflight de `PUT`
responde 204 anunciando os verbos do CRUD e o `Content-Type`, a resposta marca
`Vary: Origin`, e chamada sem `Origin` continua atendida. A leitura da variável
de ambiente é testada à parte, com lista separada por vírgula e com o padrão que
entra quando ela falta.

Implementar `src/http/cors.ts` e registrar o middleware antes das rotas e do
parser de JSON. As origens entram no `createApp` por parâmetro, com o ambiente
como padrão, para o teste não depender de variável global.

Pronto quando os casos de CORS passam e o `npm run dev` imprime as origens
liberadas ao subir.

#### Fase 15, erros diferenciados

`tests/http/errors.test.ts` ganha três casos: `ZodError` que chega ao middleware
vira 400 com `details`, erro com código `P2025` vira 404, e código diferente
dele continua virando 500.

Implementar a tradução em `error-handler.ts`, e trocar `safeParse` por `parse`
nos handlers, o que tira do controller a decisão de status.

Pronto quando os três casos passam e nenhum anterior quebra.

#### Fase 16, Insomnia, documentação e entrega

Workspace do Insomnia refeito com o caminho feliz e os erros de cada rota, mais
os dois preflights, cada requisição registrando na descrição o status esperado.
README com as seções de Zod e de CORS, esta última justificando origens, métodos
e cabeçalhos, como o enunciado cobra. `TESTES.md` com os números novos.

Pronto quando um clone limpo sobe seguindo só o README e o Insomnia importa sem
ajuste.

### Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Zod 4 mudou a API de mensagem de erro em relação ao 3 | mensagem por regra, conferida em teste que afirma o texto, e não só o campo |
| coluna obrigatória em tabela povoada quebra a migration | padrão temporário no SQL e `migrate deploy` em vez de `migrate dev`, que poderia oferecer reset |
| `.partial()` aceitaria corpo vazio e responderia 200 à toa | `.refine` cobrando ao menos um campo, com caso de teste próprio |
| migrar o prefixo quebra o que a tarefa 1 entregou | caso de teste afirmando 404 no caminho antigo, e Insomnia refeito na mesma passada |
| CORS liberado demais por curinga acidental | lista conferida por igualdade, sem `origin: true`, com teste de origem estranha |

### Checklist de entrega

- [ ] `GET`, `POST`, `PUT` e `DELETE` em `/api/products` com 200, 201, 204, 400 e 404
- [ ] Zod na criação e no `.partial()` da atualização
- [ ] `ZodError` em 400, `P2025` em 404 e o resto em 500
- [ ] `cors` restrito a `http://localhost:5173` ou ao que estiver em `ALLOWED_ORIGIN`
- [ ] `.env.example` com `DATABASE_URL`, `PORT` e `ALLOWED_ORIGIN`
- [ ] migration da coluna `imageUrl` versionada e aplicada
- [ ] seed com seis registros, todos com imagem
- [ ] workspace do Insomnia com os cenários de erro e os status esperados anotados
- [ ] README com a política de CORS justificada e exemplos de payload
- [ ] suíte verde, `npm test` sem Docker
- [ ] repositório público e vídeo de 2 a 5 minutos

## Estado da execução, 21 de setembro de 2026

Fases 11 a 16 concluídas. A suíte foi de 69 para 107 casos, o `tsc --strict`
passa e a cobertura segue em 100%, agora com 342 linhas.

A ordem real foi diferente da planejada, e por escolha. Em vez de fase por fase,
escrevi de uma vez os testes das cinco frentes, rodei e vi 39 falharem em 8
arquivos, e só então implementei até o verde. Funcionou porque as frentes se
cruzam: o prefixo `/api` aparece em todo teste de rota, e `imageUrl` aparece em
factory, seed, presenter e repositório. Separar em fases teria feito o mesmo
arquivo ser reescrito quatro vezes.

Dois ajustes durante a implementação. O primeiro: o ramo que recusava número não
finito no schema de preço ficou inalcançável, porque `z.number()` do Zod 4 já
recusa `NaN` e infinito, e a cobertura apontou as duas linhas mortas; o ramo
saiu. O segundo: a mensagem de campo vazio saía como `imageUrl deve ter no
minimo 1 caracteres`, então o gerador de mensagem passou a tratar o mínimo de um
caractere como caso próprio.

A migration `20260921133922_add_image_url` foi criada com `--create-only`,
editada à mão para o padrão temporário e aplicada com `migrate deploy` no
container que já estava no ar, sem reset e sem perder registro. O seed repovoou
com as seis imagens.

O smoke manual contra o Postgres, na porta 3333, confirmou 201 com `Location`
apontando para `/api/products/:id`, `PUT` parcial preservando os campos
ausentes, 400 no preço negativo, 404 no id inexistente, 204 na remoção, 404 na
repetição dela, e o preflight devolvendo `Access-Control-Allow-Origin` apenas
para a 5173.

Falta a entrega: commit, repositório atualizado e o vídeo de 2 a 5 minutos.
Roteiro sugerido para esta parte: o schema do Zod e um `POST` inválido mostrando
os quatro campos acusados de uma vez em 40 segundos, o `PUT` parcial em 30, o
preflight no Insomnia com as duas origens em 30, `docker ps` e Prisma Studio com
a coluna de imagem em 40, e `npm test` verde no fim.
