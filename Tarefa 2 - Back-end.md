# **Tarefa Avaliativa – CRUD com Express, Prisma e Zod**

📝 **Descrição**  
Evolua sua API back-end em **Node.js \+ TypeScript \+ Express** para implementar o **CRUD completo** de produtos (ou entidade equivalente ao seu TCC). Utilize **Prisma** para acesso ao PostgreSQL e **Zod** para validação em tempo de execução. Habilite **CORS** para permitir o consumo do front-end e **teste tudo no Insomnia**, incluindo cenários de erro.

🎯 **Objetivo**  
Entregar uma API funcional e robusta, cobrindo **Create, Read, Update, Delete** com **status codes adequados**, **validação em runtime** e **tratamento de erros**, pronta para ser consumida pelo front-end.

---

## **⚙️ Requisitos Técnicos (obrigatórios)**

### **Projeto base**

* **Node.js \+ TypeScript** configurados; servidor **Express** funcional.

* **Prisma** conectado ao Postgres (pode reutilizar o docker-compose e o schema da aula anterior).

  ### **CORS**

* Middleware `cors` registrado e **restrito** pelo menos a `http://localhost:5173` (ou variável em `.env`).

* Justifique no README a política adotada (origens, métodos, headers).

  ### **Endpoints REST (mínimo)**

* `GET /api/products` → lista todos (200 OK).

* `GET /api/products/:id` → item por ID. **400** (ID inválido), **404** (não encontrado), **500** (erro interno).

* `POST /api/products` → cria item. **201 Created** ao sucesso; **400** em payload inválido.

* `PUT /api/products/:id` → atualização **parcial** (usar schema `.partial()`); **200** com objeto atualizado; **404** se ID inexistente (tratar **P2025** do Prisma).

* `DELETE /api/products/:id` → **204 No Content**; **404** se ID inexistente.

  ### **Validação com Zod (runtime)**

* Schema de **criação** com regras mínimas:

  * `title`: `string().min(3)` (mensagem clara).

  * `description`: `string().min(10)`.

  * `imageUrl`: `string().min(1)` (ou `url()` se preferir absoluto).

* Schema de **atualização**: **partial** do schema de criação.

* No `catch`, diferenciar **ZodError (400)** de erros internos **(500)** e de **P2025 (404)**.

  ### **Banco com Docker Compose**

* Reusar/ajustar `docker-compose.yml` do Postgres com usuário, senha, DB, porta mapeada e volume.

* `.env` com `DATABASE_URL` e **(novo)** `ALLOWED_ORIGIN` e/ou `PORT`.

  ### **Scripts úteis (package.json)**

* `"dev"` (servidor com tsx/nodemon).

* `"prisma:migrate"` e `"prisma:studio"`.

* `"seed"` (popular registros mínimos, ≥ 5 itens).

  ### **Testes no Insomnia (obrigatório)**

Workspace com requisições para:

* `GET /api/products`

* `GET /api/products/:id` (válido e inválido)

* `POST /api/products` (payload válido e inválido)

* `PUT /api/products/:id` (válido; e inválido: `price` negativo, ID inexistente)

* `DELETE /api/products/:id` (válido e inexistente)

> Inclua **notas** no Insomnia (ou README) registrando os **status esperados** (200/201/204/400/404/500).

---

## **📦 Entrega (no SIGAA)**

1. **Repositório GitHub (público)** com:

* Código-fonte (API \+ Prisma \+ Docker Compose).

* `README.md` com **passo a passo**: subir Docker, migrar/seed, rodar servidor, testar no Insomnia; políticas de CORS e exemplos de payloads.

* Arquivos de configuração (`.env.example` com chaves necessárias, sem segredos).

2. **Demonstração (vídeo ou áudio, 2–5 min)** explicando e mostrando:

* Containers do Postgres rodando (Docker Desktop/CLI).

* `npx prisma studio` com dados.

* Chamadas no Insomnia (sucesso e erros).

* Breve explicação de como o **Zod** impede dados inválidos.

Em caso de **áudio**, anexar **prints** do Docker, Prisma Studio e Insomnia.

