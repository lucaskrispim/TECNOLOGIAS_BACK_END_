# Catalogo de produtos, API em Node, TypeScript, Express e Prisma

Tarefas 1, 2 e 3 da disciplina de Tecnologias Back-End. API REST que persiste um
catalogo de produtos em PostgreSQL 15 rodando em container, com Prisma para
modelagem, migration e seed.

A tarefa 2 acrescentou o CRUD completo sob o prefixo `/api`, validacao de
runtime com Zod, CORS restrito ao front de desenvolvimento e o campo `imageUrl`
no modelo.

A tarefa 3 acrescentou registro e login de usuarios, com senha guardada como
hash bcrypt e autenticacao por JWT. Um middleware protege a escrita em
`/api/products` (`POST`, `PUT` e `DELETE`), e a leitura continua publica.

O projeto foi escrito com teste primeiro: cada rota nasceu de um teste que
falhava antes de existir implementacao. A suite tem 248 casos e roda em SQLite,
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
# troque o JWT_SECRET do .env por um valor proprio:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

docker compose up -d     # sobe o PostgreSQL 15 (ou docker-compose up -d)
npm run prisma:migrate   # cria as tabelas products e users
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

| Metodo | Rota | Token | Resposta |
| --- | --- | --- | --- |
| GET | `/` | nao | 200 com `{"status":"ok"}` |
| POST | `/api/auth/register` | nao | 201 com `user` e `token`, 400 se o corpo for invalido, 409 se o e-mail ja existir |
| POST | `/api/auth/login` | nao | 200 com `user` e `token`, 400 se o corpo for invalido, 401 se e-mail ou senha nao conferirem |
| GET | `/api/auth/me` | sim | 200 com `{ "user": ... }`, 401 sem token ou com token invalido |
| GET | `/api/products` | nao | 200 com a lista, do mais recente para o mais antigo |
| GET | `/api/products/:id` | nao | 200 com o produto, 404 se nao existir, 400 se o id nao for inteiro positivo |
| POST | `/api/products` | sim | 201 com o produto criado e cabecalho `Location`, 400 se o corpo for invalido |
| PUT | `/api/products/:id` | sim | 200 com o produto atualizado, 404 se nao existir, 400 se o corpo for invalido |
| DELETE | `/api/products/:id` | sim | 204 sem corpo, 404 se nao existir |

Nas rotas marcadas com token, a requisicao precisa do cabecalho
`Authorization: Bearer <token>`. Sem ele, ou com token invalido ou expirado, a
resposta e 401 antes de qualquer validacao de corpo ou de id.

O `PUT` e parcial: manda so o que muda. O corpo passa pelo schema de criacao em
versao `.partial()`, entao enviar o objeto inteiro tambem funciona. Corpo sem
nenhum campo conhecido responde 400, porque atualizacao que nao altera nada e
pedido malformado.

Exemplo de criacao, com o token obtido no login (veja a secao seguinte):

```bash
curl -X POST http://localhost:3000/api/products \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
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
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "price": "289.90" }'
```

O preco vai e volta como string. Numero de ponto flutuante em JSON perderia
centavo, e a coluna no banco e `numeric(10,2)`. O campo aceita string ou numero
na entrada, sempre com no maximo duas casas decimais, e sai normalizado com
duas casas.

## Autenticacao

### Passo a passo

1. Cadastre um usuario em `POST /api/auth/register`. A resposta ja traz um
   token, entao nao e preciso fazer login logo em seguida.
2. Em outra sessao, obtenha um token novo em `POST /api/auth/login`.
3. Envie o token no cabecalho `Authorization: Bearer <token>` em
   `GET /api/auth/me` e nas escritas de `/api/products`.
4. Quando o token expirar (7 dias por padrao), a API responde 401 com a mensagem
   `token expirado`, e basta fazer login de novo.

### Payloads

Registro:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'content-type: application/json' \
  -d '{ "name": "Maria Souza", "email": "maria@exemplo.com", "password": "senha-forte-123" }'
```

```json
{
  "user": {
    "id": 1,
    "name": "Maria Souza",
    "email": "maria@exemplo.com",
    "createdAt": "2026-10-09T13:52:23.164Z",
    "updatedAt": "2026-10-09T13:52:23.164Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTE1N..."
}
```

Login, com a mesma forma de resposta do registro e status 200:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{ "email": "maria@exemplo.com", "password": "senha-forte-123" }'
```

Para guardar o token no shell e usar nos exemplos de produto:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{ "email": "maria@exemplo.com", "password": "senha-forte-123" }' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

Usuario autenticado:

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

```json
{
  "user": {
    "id": 1,
    "name": "Maria Souza",
    "email": "maria@exemplo.com",
    "createdAt": "2026-10-09T13:52:23.164Z",
    "updatedAt": "2026-10-09T13:52:23.164Z"
  }
}
```

Sem token, ou com token invalido:

```json
{ "error": "unauthorized", "message": "token ausente: envie Authorization: Bearer <token>" }
```

Credencial errada no login, com a mesma resposta para e-mail inexistente e para
senha errada:

```json
{ "error": "unauthorized", "message": "email ou senha invalidos" }
```

### Modelo de usuario

| Coluna | Tipo | Observacao |
| --- | --- | --- |
| `id` | `serial` | chave primaria |
| `name` | `varchar(120)` | |
| `email` | `varchar(254)`, unico | gravado aparado e em minusculas |
| `passwordHash` | `varchar(60)` | hash bcrypt; a senha nunca e gravada |
| `createdAt`, `updatedAt` | `timestamp(3)` | |

### Decisoes de seguranca

A senha vira hash com bcrypt, custo 10 por padrao (`BCRYPT_ROUNDS`), e nem a
senha nem o hash aparecem em resposta alguma: o presenter de usuario lista os
campos de saida um a um.

O token e um JWT HS256 assinado com `JWT_SECRET`, com o id do usuario em `sub`
e expiracao em `JWT_EXPIRES_IN`. O algoritmo e fixo tambem na verificacao, o
que barra token com `alg: none` ou assinado com outro algoritmo. A API se
recusa a subir sem `JWT_SECRET` ou com segredo de menos de 32 caracteres.

O login responde igual para e-mail inexistente e senha errada, e roda o bcrypt
nos dois casos, para que nem a mensagem nem o tempo de resposta revelem quais
e-mails tem conta.

O e-mail e normalizado antes de gravar e de buscar, entao `Maria@Exemplo.com` e
`maria@exemplo.com` sao a mesma conta. A unicidade e garantida pelo indice do
banco, e nao por uma consulta previa, para que dois cadastros simultaneos nao
passem os dois.

O middleware `requireAuth` nao consulta o banco: confere assinatura e validade
do token e guarda o id em `res.locals`. Por consequencia, o token de uma conta
apagada continua aceito na escrita de produtos ate expirar, que e o preco do JWT
sem estado. O `/api/auth/me`, que precisa do registro, responde 401 nesse caso.

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

Registro e login tem schema proprio, em `src/auth/auth.schema.ts`:

| Campo | Regra |
| --- | --- |
| `name` | texto de 2 a 120 caracteres, contados depois de aparar as pontas |
| `email` | formato de e-mail valido, ate 254 caracteres, aparado e passado para minusculas |
| `password` no registro | no minimo 6 caracteres e no maximo 72 bytes. Nao e aparada |
| `password` no login | nao vazia e no maximo 72 bytes |

O teto de 72 bytes vem do bcrypt, que ignora em silencio o que passar disso. A
conta e em bytes, e nao em caracteres: uma letra acentuada ocupa dois.

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
| cabecalhos | `Content-Type`, `Authorization` | a API troca JSON, e a escrita exige o token Bearer. Sem `Authorization` na lista, o navegador barraria o preflight do `POST` |
| credenciais | desligadas | a API nao usa cookie nem sessao: o token vai no cabecalho |

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
| token ausente, invalido ou expirado, credencial errada | 401 | `unauthorized` | middleware `requireAuth` e login |
| produto ou rota inexistente | 404 | `not_found` | `P2025` do Prisma, ou rota sem handler |
| e-mail ja cadastrado | 409 | `conflict` | `P2002` do Prisma, o indice unico |
| corpo acima de 100 kB | 413 | `payload_too_large` | parser do Express |
| falha nao prevista | 500 | `internal_error` | qualquer outra excecao |

O 500 devolve mensagem generica: stack e mensagem interna ficam no log do
servidor, nunca no corpo da resposta. O 401 traz tambem o cabecalho
`WWW-Authenticate: Bearer realm="api"`, que diz ao cliente qual esquema usar.

## Testes com o Insomnia

### Autenticacao, tarefa 3

O arquivo `insomnia/catalogo-auth.insomnia.json` traz dezoito requisicoes em
tres pastas, cobrindo os cenarios que o enunciado pede:

| Pasta | Requisicao | Esperado |
| --- | --- | --- |
| 1. Autenticacao | registro valido, e-mail repetido, corpo invalido | 201, 409, 400 |
| 1. Autenticacao | login valido, senha errada, e-mail inexistente, corpo invalido | 200, 401, 401, 400 |
| 2. Usuario autenticado | `/auth/me` sem token, com token invalido, com token | 401, 401, 200 |
| 3. Products | `GET` publico | 200 |
| 3. Products | `POST` sem token, com token invalido, com token | 401, 401, 201 |
| 3. Products | `PUT` sem token, com token | 401, 200 |
| 3. Products | `DELETE` sem token, com token | 401, 204 |

O token nao precisa ser copiado a mao. A variavel `token` do ambiente le o
campo `token` da resposta de `POST /api/auth/login valido`, e se essa
requisicao ainda nao rodou o Insomnia a dispara sozinho. As variaveis `email` e
`password` definem a conta usada no registro e no login. Rode o registro valido
uma vez; depois disso ele passa a responder 409, que e o cenario seguinte da
pasta. Aponte `id_valido` e `id_removivel` para o id devolvido pelo
`POST /api/products com token`.

Um teste automatizado, `tests/contract/insomnia.contract.test.ts`, confere que
a colecao continua cobrindo cada um desses cenarios.

### CRUD, tarefa 2

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

Essas duas colecoes sao da tarefa 2, anteriores a autenticacao: os `POST`,
`PUT` e `DELETE` delas agora respondem 401, porque nao enviam token. Para a
escrita, use a colecao da tarefa 3.

## Testes automatizados

```bash
npm test          # 248 casos, nao precisa de Docker
npm run test:watch
npm run typecheck
```

| Pasta | Casos | O que verifica |
| --- | --- | --- |
| `tests/unit` | 113 | schemas, configuracao, bcrypt, JWT, middleware e service, sem banco e sem HTTP |
| `tests/integration` | 24 | repositorios e seed contra SQLite de verdade, inclusive o indice unico de e-mail |
| `tests/http` | 82 | cada rota com Supertest: status, corpo e cabecalho |
| `tests/e2e` | 4 | a API num socket real, chamada por `fetch`, na jornada registro, perfil, escrita e login |
| `tests/regression` | 7 | o que a tarefa 2 entregava e precisa continuar igual depois da autenticacao |
| `tests/security` | 9 | senha fora das respostas, enumeracao de conta, atribuicao em massa, token forjado |
| `tests/contract` | 9 | formato das respostas validado por schema, e cobertura da colecao do Insomnia |

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
  migrations/          migrations versionadas: init, imageUrl e users
  seed.ts              casca de linha de comando do seed
scripts/
  gen-sqlite-schema.mjs  deriva o schema de teste do principal
src/
  app.ts               monta o Express, recebe as dependencias por parametro
  server.ts            unico lugar que chama listen
  db/client.ts         escolhe o client conforme DB_DRIVER
  auth/                configuracao, bcrypt, JWT, middleware, schema, service, rotas
  http/                cors, erros, middleware de erro e parsing de parametro
  products/            rota, controller, service, repositorio, schema Zod, presenter, seed
  users/               repositorio e presenter de usuario
tests/
  unit/                schema, presenter, parsing, token, senha e middleware, sem banco
  integration/         repositorios e seed contra SQLite
  http/                rotas com Supertest
  e2e/                 API num socket real, chamada por fetch
  regression/          comportamento anterior que precisa continuar igual
  security/            vazamento de senha, enumeracao, token forjado
  contract/            formato das respostas e cobertura do Insomnia
  support/             app de teste, controle do banco, usuario autenticado e factories
insomnia/              workspace exportado
```

As dependencias entram por parametro: `createApp` recebe os services e o
servico de token, e cada repositorio recebe o client do Prisma. E isso que permite a suite apontar para
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

## Roteiro da demonstracao

1. `docker compose up -d`, `npm run prisma:migrate` e `npm run dev`.
2. `npm run prisma:studio` e mostrar a tabela `users` vazia.
3. No Insomnia, pasta 1: registro valido (201), e-mail repetido (409), corpo
   invalido (400), login valido (200), senha errada (401).
4. Voltar ao Prisma Studio e mostrar o usuario com `passwordHash` em bcrypt.
5. Pasta 2: `/auth/me` sem token (401) e com token (200).
6. Pasta 3: `POST`, `PUT` e `DELETE` sem token (401) e com token (201, 200, 204),
   conferindo no Prisma Studio que o produto foi criado e removido.

## Problemas comuns

**A API nao sobe e diz `JWT_SECRET nao definido`.** Falta a variavel no `.env`.
Copie o bloco de autenticacao do `.env.example` e gere um segredo com o comando
que esta no proprio arquivo.

**O Insomnia devolve 401 numa escrita com token.** O token expirou ou o
`JWT_SECRET` mudou desde o login. Rode de novo o login valido.

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
