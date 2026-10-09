# Testes e cobertura

Relatório gerado em 9 de outubro de 2026, com `npm run test:coverage`, já com a
autenticação da tarefa 3 sobre o CRUD, o Zod e o CORS da tarefa 2.

## Números

| Métrica | Resultado | Piso configurado |
| --- | --- | --- |
| casos de teste | 248, em 30 arquivos | |
| linhas | 100%, 578 de 578 | 90% |
| instruções | 100% | 90% |
| ramos | 100% | 85% |
| funções | 100% | 90% |
| tempo da suíte | cerca de 10 segundos | |

O piso é verificado pelo próprio Vitest: se a cobertura cair abaixo dele, o
comando falha.

## Como a autenticação foi escrita

Os testes da tarefa 3 vieram antes do código. A primeira rodada, com os testes
novos e nenhuma implementação, terminou com 23 arquivos falhando por falta dos
módulos e da tabela `users`. A implementação foi escrita até a suíte ficar
verde, e os testes antigos de escrita em produto passaram a enviar token, já que
o comportamento esperado deles mudou.

Cobertura mede linha executada, não comportamento verificado. Para conferir que
os testes de fato pegam defeito, quinze defeitos plausíveis foram reintroduzidos
no código, um por vez, e a suíte rodada a cada um. Todos foram detectados:

| Defeito reintroduzido | Testes que falharam |
| --- | --- |
| `POST /api/products` sem o middleware | 8 |
| `DELETE /api/products/:id` sem o middleware | 4 |
| `jwt.verify` sem algoritmo fixo | 1 |
| login que pula o bcrypt quando o e-mail não existe | 1 |
| mensagens diferentes para e-mail inexistente e senha errada | 2 |
| CORS sem `Authorization` na lista de cabeçalhos | 2 |
| presenter de usuário devolvendo `passwordHash` | 6 |
| senha mínima de 5 em vez de 6 | 3 |
| e-mail gravado sem passar para minúsculas | 5 |
| regex do Bearer sem âncora no fim | 1 |
| 401 sem `WWW-Authenticate` | 2 |
| corpo grande demais virando 500 | 1 |
| `/auth/me` de conta apagada dando 404 em vez de 401 | 2 |
| token com `sub` igual a 0 aceito | 1 |
| segredo de 1 caractere aceito | 1 |

Fora da suíte, o fluxo completo foi verificado contra o Postgres do
`docker-compose`, com a migration `add_users` aplicada: registro 201, e-mail
repetido 409, corpo inválido 400, login 200 e 401, `/me` 401 e 200, e escrita
em produto 401 sem token e 201, 200 e 204 com token. O hash gravado começa com
`$2b$10$` e tem 60 caracteres. A API também foi iniciada sem `JWT_SECRET` e
saiu com código 1, sem abrir a porta.

## Os níveis

| Pasta | Casos | O que verifica |
| --- | --- | --- |
| `tests/unit` | 113 | regras puras, sem banco e sem HTTP |
| `tests/integration` | 24 | repositórios e seed contra SQLite de verdade |
| `tests/http` | 82 | cada rota com Supertest |
| `tests/e2e` | 4 | a API num socket real, chamada por `fetch` |
| `tests/regression` | 7 | o que a tarefa 2 entregava e precisa continuar igual |
| `tests/security` | 9 | ataques e vazamentos conhecidos |
| `tests/contract` | 9 | formato das respostas e cobertura do Insomnia |

**Unitário.** Os schemas do Zod levam a maior parte, com os limites testados nos
dois lados da fronteira: senha de 5 caracteres falha e de 6 passa, 72 bytes
passam e 73 falham, e a conta em bytes é conferida com letra acentuada, que
ocupa dois. O serviço de token é testado contra token expirado um segundo
depois do prazo e aceito um segundo antes, assinado com outro segredo, com
`alg: none`, com HS512 no lugar de HS256, com payload adulterado, com payload em
texto puro e com `sub` ausente, vazio, zero, negativo, fracionário, numérico e
acima do inteiro seguro. O middleware é testado com cabeçalho ausente, vazio,
repetido, com esquema `Basic`, `Token` e `JWT`, sem token depois do Bearer e
com dois tokens. O service usa repositório em memória e hasher falso, e
verifica que o bcrypt roda mesmo quando o e-mail não existe.

**Integração.** O repositório de usuário roda contra SQLite, e o caso que mais
importa é o de dois cadastros simultâneos do mesmo e-mail: grava um só, porque
quem decide é o índice único do banco e não uma consulta prévia.

**Rota.** Registro, login e `/me` em todos os status que o enunciado lista. A
matriz de proteção de produtos roda as três escritas sem token, com token
inválido e com token válido, confere que a falha não altera o banco, e fixa a
ordem: sem token, corpo inválido dá 401 e não 400, e id inválido dá 401 e não
400. A leitura continua pública mesmo com um token inválido no cabeçalho.

**Ponta a ponta.** A API sobe em porta escolhida pelo sistema e o teste fala
com ela por `fetch`, sem Supertest. Uma jornada só cobre tentativa de escrita
sem conta, registro, perfil, criação, alteração, leitura pública, login errado,
login certo e remoção com o token do login. Outros casos verificam o preflight
do navegador com `Authorization` e que a resposta 401 leva o cabeçalho de CORS,
sem o qual o front não conseguiria ler o erro.

**Regressão.** `GET /` continua público, rota inexistente sob `/api/auth`
continua 404 em JSON, verbo errado numa rota de auth não vira 500, o contrato
de produto não ganhou nem perdeu campo, e 401 e 409 seguem o mesmo formato de
erro dos outros status. Este nível também pegou um defeito anterior à tarefa 3:
corpo acima de 100 kB caía no 500 genérico, e agora responde 413.

**Segurança.** Senha e hash não aparecem em nenhuma resposta, o banco guarda
hash bcrypt, e-mail inexistente e senha errada dão resposta idêntica, `id` e
`passwordHash` enviados no registro são ignorados, objeto no lugar do e-mail
dá 400, token de 8000 caracteres dá 401, token com `alg: none` não grava
produto, e a mensagem do 401 não repassa o texto interno da biblioteca de JWT.

**Contrato.** As respostas de registro, login, `/me` e de erro são validadas
por schemas estritos do Zod, que quebram se aparecer campo a mais. A coleção do
Insomnia é lida pelo teste, que confere que ela cobre cada cenário pedido pelo
enunciado e que o token vem sempre de variável de ambiente.

## Cobertura por arquivo

| Arquivo | Linhas | Ramos |
| --- | --- | --- |
| `src/app.ts` | 16/16 | 100% |
| `src/auth/auth.config.ts` | 35/35 | 100% |
| `src/auth/auth.controller.ts` | 17/17 | 100% |
| `src/auth/auth.middleware.ts` | 27/27 | 100% |
| `src/auth/auth.routes.ts` | 9/9 | 100% |
| `src/auth/auth.schema.ts` | 33/33 | 100% |
| `src/auth/auth.service.ts` | 22/22 | 100% |
| `src/auth/password.ts` | 7/7 | 100% |
| `src/auth/token.ts` | 28/28 | 100% |
| `src/db/client.ts` | 11/11 | 100% |
| `src/http/cors.ts` | 22/22 | 100% |
| `src/http/error-handler.ts` | 57/57 | 100% |
| `src/http/errors.ts` | 41/41 | 100% |
| `src/http/params.ts` | 8/8 | 100% |
| `src/products/product.controller.ts` | 26/26 | 100% |
| `src/products/product.presenter.ts` | 11/11 | 100% |
| `src/products/product.repository.ts` | 32/32 | 100% |
| `src/products/product.routes.ts` | 11/11 | 100% |
| `src/products/product.schema.ts` | 57/57 | 100% |
| `src/products/product.seed.ts` | 54/54 | 100% |
| `src/products/product.service.ts` | 22/22 | 100% |
| `src/users/user.presenter.ts` | 9/9 | 100% |
| `src/users/user.repository.ts` | 23/23 | 100% |

Duas exclusões deliberadas, declaradas em `vitest.config.mts`. `src/generated/`
é o client do Prisma, código gerado. E `src/server.ts` só lê o ambiente, monta
as dependências e chama `listen`, comportamento verificado no teste manual
contra o Postgres.

## Como reproduzir

```bash
npm run test:coverage      # texto no terminal mais coverage/ em HTML e lcov
xdg-open coverage/index.html
```

## O que a suíte não cobre

A precisão de centavo só é garantida de fato no Postgres. SQLite guarda a coluna
`DECIMAL` com afinidade numérica, e o presenter uniformiza a saída.

O tempo de resposta do login não é medido. A suíte verifica que o bcrypt roda
nos dois caminhos, que é a causa da igualdade de tempo, mas não cronometra,
porque cronometragem em teste automatizado é instável.

Token de conta apagada continua valendo na escrita de produtos até expirar. É
consequência do JWT sem estado e está documentada no README; o `/me` recusa esse
caso.

Concorrência alta, carga e o `docker-compose` em si ficam para a verificação
manual do roteiro de entrega.
