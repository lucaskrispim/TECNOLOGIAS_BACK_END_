# Testes e cobertura

Relatório gerado em 21 de setembro de 2026, com `npm run test:coverage` sobre o
commit corrente, já com o CRUD, o Zod e o CORS da tarefa 2.

## Números

| Métrica | Resultado | Piso configurado |
| --- | --- | --- |
| casos de teste | 107, em 12 arquivos | |
| linhas | 100%, 342 de 342 | 90% |
| instruções | 100% | 90% |
| ramos | 100% | 85% |
| funções | 100% | 90% |
| tempo da suíte | cerca de 3 segundos | |

O piso é verificado pelo próprio Vitest: se a cobertura cair abaixo dele, o
comando falha. Ficar em 100% num projeto deste tamanho é razoável, e o piso
existe justamente para não travar a evolução em 100% exato.

## Cobertura por arquivo

| Arquivo | Linhas | Ramos |
| --- | --- | --- |
| `src/app.ts` | 14/14 | 100% |
| `src/db/client.ts` | 11/11 | 100% |
| `src/http/cors.ts` | 22/22 | 100% |
| `src/http/error-handler.ts` | 48/48 | 100% |
| `src/http/errors.ts` | 26/26 | 100% |
| `src/http/params.ts` | 8/8 | 100% |
| `src/products/product.controller.ts` | 26/26 | 100% |
| `src/products/product.presenter.ts` | 11/11 | 100% |
| `src/products/product.repository.ts` | 32/32 | 100% |
| `src/products/product.routes.ts` | 11/11 | 100% |
| `src/products/product.schema.ts` | 57/57 | 100% |
| `src/products/product.seed.ts` | 54/54 | 100% |
| `src/products/product.service.ts` | 22/22 | 100% |

Duas exclusões deliberadas, declaradas em `vitest.config.mts`. `src/generated/`
é o client do Prisma, código gerado que não é nosso. E `src/server.ts` só lê a
porta e as origens do CORS e chama `listen`, comportamento verificado no smoke
manual contra o Postgres: cobri-lo pediria abrir socket na suíte, o que traria
porta ocupada e teste instável em troca de nada.

## Como reproduzir

```bash
npm run test:coverage      # texto no terminal mais coverage/ em HTML e lcov
xdg-open coverage/index.html
```

O relatório sai em `coverage/`, que está no `.gitignore`: é artefato, não fonte.

## Os três níveis

**Unitário, 41 casos, sem banco e sem HTTP.** Os schemas do Zod levam 25,
seleção de client 5, formatação da resposta 5, parsing de id 3 e tradução de
erro do Prisma 3. São os testes que rodam em milissegundos e onde fica o volume
das regras.

**Integração, 19 casos, contra SQLite de verdade.** Doze do repositório e sete
do seed. Este nível pega o que mock não pega: erro de query, mapeamento de tipo,
comportamento do `@updatedAt`, atualização parcial de coluna e o formato com que
o banco devolve `Decimal`.

**Rota, 47 casos, com Supertest sobre o app.** Escrita com 19, CORS com 11,
leitura com 8, contrato de erro com 6 e status da API com 3. Sobem o Express de
verdade e verificam status, corpo e cabeçalho no fluxo completo, do JSON de
entrada até o registro no banco.

| Arquivo de teste | Casos | Nível |
| --- | --- | --- |
| `tests/unit/product.schema.test.ts` | 25 | unitário |
| `tests/unit/db.client.test.ts` | 5 | unitário |
| `tests/unit/product.presenter.test.ts` | 5 | unitário |
| `tests/unit/params.test.ts` | 3 | unitário |
| `tests/unit/product.repository.errors.test.ts` | 3 | unitário |
| `tests/integration/product.repository.test.ts` | 12 | integração |
| `tests/integration/product.seed.test.ts` | 7 | integração |
| `tests/http/products.write.test.ts` | 19 | rota |
| `tests/http/cors.test.ts` | 11 | rota |
| `tests/http/products.read.test.ts` | 8 | rota |
| `tests/http/errors.test.ts` | 6 | rota |
| `tests/http/status.test.ts` | 3 | rota |

## O que a suíte garante de fato

Cobertura mede linha executada, não comportamento verificado, então vale
registrar o que os casos afirmam.

Sobre dinheiro: preço com mais de duas casas é rejeitado, o teto de
`numeric(10,2)` é respeitado, a comparação com esse teto é feita dígito a dígito
sem ponto flutuante, e a resposta sai como string de duas casas mesmo quando o
banco devolve uma. O último ponto existe porque SQLite devolve `349.9` e
Postgres devolve `349.90` para o mesmo dado.

Sobre validação: cada regra do schema tem caso próprio, inclusive os limites
exatos de 3 e de 10 caracteres, e a contagem depois de aparar as pontas. O erro
acusa todos os campos inválidos de uma vez. Campo desconhecido é descartado
antes do banco, e o `PUT` com corpo vazio ou só com campo desconhecido responde
400, em vez de gravar nada e dizer que deu certo.

Sobre erro: id fora do formato dá 400 e não 404 nem 500, produto ausente dá 404,
rota ausente dá 404 em JSON e não o HTML do Express, JSON malformado dá 400 e não
500, e falha não prevista dá 500 sem stack nem mensagem interna no corpo, com o
detalhe indo para o log. O `P2025` do Prisma vira 404 tanto quando a camada de
dados o traduz quanto quando ele escapa até o middleware, e código diferente
dele continua virando 500, em vez de um 404 enganoso.

Sobre escrita: o `PUT` parcial altera só o campo enviado e preserva os demais, o
que o teste confirma lendo o registro depois. A validação roda antes de tocar no
banco, inclusive antes de procurar um id que não existe. Id enviado no corpo é
ignorado. O segundo `DELETE` do mesmo id dá 404.

Sobre CORS: a origem configurada recebe `Access-Control-Allow-Origin`, origem de
fora da lista não recebe, o preflight do `PUT` responde 204 anunciando os verbos
do CRUD e o `Content-Type`, a resposta marca `Vary: Origin`, e chamada sem
`Origin`, como a do Insomnia, continua atendida. A leitura da variável de
ambiente é testada à parte, com lista separada por vírgula e com o padrão que
entra quando ela falta.

Sobre dados: todo registro do seed passa pelo mesmo schema que a API aplica ao
corpo da requisição, então não existe dado semeado que a API rejeitaria, e todos
têm imagem. O seed roda duas vezes sem duplicar.

## O que a suíte não cobre

A precisão de centavo só é garantida de fato no Postgres. SQLite guarda a coluna
`DECIMAL` com afinidade numérica, o valor vira `real` por baixo, e o presenter
uniformiza a saída. O caso de precisão no limite, `12345678.99`, foi verificado
no smoke manual contra o Postgres, não na suíte.

O CORS é testado no que o servidor envia. Se o navegador de fato bloqueia a
resposta é comportamento dele, verificado à mão com o front na 5173.

Também ficam fora concorrência, carga e o `docker-compose` em si, que são
verificados à mão no roteiro de entrega.
