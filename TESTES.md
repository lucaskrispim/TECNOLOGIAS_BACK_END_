# Testes e cobertura

Relatório gerado em 3 de setembro de 2026, com `npm run test:coverage` sobre o
commit corrente.

## Números

| Métrica | Resultado | Piso configurado |
| --- | --- | --- |
| casos de teste | 69, em 11 arquivos | |
| linhas | 100%, 323 de 323 | 90% |
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
| `src/app.ts` | 12/12 | 100% |
| `src/db/client.ts` | 11/11 | 100% |
| `src/http/error-handler.ts` | 32/32 | 100% |
| `src/http/errors.ts` | 26/26 | 100% |
| `src/http/params.ts` | 8/8 | 100% |
| `src/products/product.controller.ts` | 31/31 | 100% |
| `src/products/product.presenter.ts` | 10/10 | 100% |
| `src/products/product.repository.ts` | 32/32 | 100% |
| `src/products/product.routes.ts` | 11/11 | 100% |
| `src/products/product.seed.ts` | 48/48 | 100% |
| `src/products/product.service.ts` | 22/22 | 100% |
| `src/products/product.validation.ts` | 80/80 | 100% |

Duas exclusões deliberadas, declaradas em `vitest.config.mts`. `src/generated/`
é o client do Prisma, código gerado que não é nosso. E `src/server.ts` só lê a
porta e chama `listen`, comportamento verificado no smoke manual contra o
Postgres: cobri-lo pediria abrir socket na suíte, o que traria porta ocupada e
teste instável em troca de nada.

## Como reproduzir

```bash
npm run test:coverage      # texto no terminal mais coverage/ em HTML e lcov
xdg-open coverage/index.html
```

O relatório sai em `coverage/`, que está no `.gitignore`: é artefato, não fonte.

## Os três níveis

**Unitário, 30 casos, sem banco e sem HTTP.** Validação de entrada com 15 casos,
formatação da resposta com 4, parsing de id com 3, seleção de client com 5 e
tradução de erro do Prisma com 3. São os testes que rodam em milissegundos e
onde fica o volume das regras.

**Integração, 16 casos, contra SQLite de verdade.** Dez do repositório e seis do
seed. Este nível pega o que mock não pega: erro de query, mapeamento de tipo,
comportamento do `@updatedAt` e o formato com que o banco devolve `Decimal`.

**Rota, 23 casos, com Supertest sobre o app.** Status da API com 3, leitura com
6, escrita com 11 e contrato de erro com 3. Sobem o Express de verdade e
verificam status, corpo e cabeçalho no fluxo completo, do JSON de entrada até o
registro no banco.

| Arquivo de teste | Casos | Nível |
| --- | --- | --- |
| `tests/unit/product.validation.test.ts` | 15 | unitário |
| `tests/unit/db.client.test.ts` | 5 | unitário |
| `tests/unit/product.presenter.test.ts` | 4 | unitário |
| `tests/unit/params.test.ts` | 3 | unitário |
| `tests/unit/product.repository.errors.test.ts` | 3 | unitário |
| `tests/integration/product.repository.test.ts` | 10 | integração |
| `tests/integration/product.seed.test.ts` | 6 | integração |
| `tests/http/products.write.test.ts` | 11 | rota |
| `tests/http/products.read.test.ts` | 6 | rota |
| `tests/http/status.test.ts` | 3 | rota |
| `tests/http/errors.test.ts` | 3 | rota |

## O que a suíte garante de fato

Cobertura mede linha executada, não comportamento verificado, então vale
registrar o que os casos afirmam.

Sobre dinheiro: preço com mais de duas casas é rejeitado, o teto de
`numeric(10,2)` é respeitado, a comparação com esse teto é feita dígito a dígito
sem ponto flutuante, e a resposta sai como string de duas casas mesmo quando o
banco devolve uma. O último ponto existe porque SQLite devolve `349.9` e
Postgres devolve `349.90` para o mesmo dado.

Sobre erro: id fora do formato dá 400 e não 404 nem 500, produto ausente dá 404,
rota ausente dá 404 em JSON e não o HTML do Express, JSON malformado dá 400 e não
500, e falha não prevista dá 500 sem stack nem mensagem interna no corpo, com o
detalhe indo para o log. Erro do Prisma que não seja registro ausente é
propagado, em vez de virar um 404 enganoso.

Sobre escrita: `PUT` valida antes de tocar no banco, e o teste confirma lendo o
registro depois para ver que não mudou. Campo desconhecido no corpo é descartado
e não chega ao banco. Id enviado no corpo é ignorado. O segundo `DELETE` do
mesmo id dá 404.

Sobre dados: todo registro do seed passa pela mesma validação que a API aplica
ao corpo da requisição, então não existe dado semeado que a API rejeitaria. E o
seed roda duas vezes sem duplicar.

## O que a suíte não cobre

A precisão de centavo só é garantida de fato no Postgres. SQLite guarda a coluna
`DECIMAL` com afinidade numérica, o valor vira `real` por baixo, e o presenter
uniformiza a saída. O caso de precisão no limite, `12345678.99`, foi verificado
no smoke manual contra o Postgres, não na suíte.

Também ficam fora concorrência, carga e o `docker-compose` em si, que são
verificados à mão no roteiro de entrega.
