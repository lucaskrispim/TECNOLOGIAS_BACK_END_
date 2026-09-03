# Tarefa Avaliativa – Catálogo de Produtos (API \+ Banco de Dados com Docker, PostgreSQL e Prisma)

📝 **Descrição:**  
Implemente uma API back-end em **Node.js \+ TypeScript \+ Express** que **persiste produtos em um banco PostgreSQL**. Use **Docker/Docker Compose** para subir o banco e **Prisma** para modelagem, migrations e seed. Teste os endpoints com **Insomnia**.

🎯 **Objetivo:**  
Entregar um pequeno **catálogo de produtos** com dados reais no banco, validando todo o fluxo: servidor Express → Prisma → PostgreSQL (em container Docker) → requisições testadas no Insomnia.

OBS: Não é necessário que sejam produtos. Pode ser algo análogo, especialmente se for relacionado ao seu TCC.

---

⚙️ **Requisitos Técnicos (obrigatórios)**

🔹 **Projeto Node.js \+ TypeScript**

* Inicialização do projeto com TypeScript configurado.  
* Servidor **Express** funcional.

🔹 **Endpoints REST (mínimo)**

* `GET /` → retorna um JSON simples com status da API (ex.: `{ "status": "ok" }`).  
* `GET /products` → retorna todos os produtos do banco (lista).  
* `GET /products/:id` → retorna um produto por **id** (404 quando não encontrado).

> Opcional: `POST /products` (criar), `PUT /products/:id` (atualizar), `DELETE /products/:id` (remover).

🔹 **Banco com Docker Compose**

* Arquivo `docker-compose.yml` subindo **PostgreSQL 15** com:

  * usuário, senha e nome do banco definidos por variáveis de ambiente;  
  * **porta mapeada** (ex.: `5432:5432`);  
  * **volume** para persistência de dados.

🔹 **Prisma (ORM)**

* `schema.prisma` com o modelo **Product** (mínimo):  
  * `id` (Int, @id, @default(autoincrement()))  
  * `title` (String, mapeado para `title`)  
  * `description` (String ou `@db.Text`)  
  * `createdAt` / `updatedAt` (DateTime; `@default(now())`, `@updatedAt`)  
* **Migration** inicial criada e aplicada (`npx prisma migrate dev --name init`).  
* **Seed** para popular ao menos **5 produtos** reais (arquivo `prisma/seed.ts` \+ script no `package.json`).  
* **Prisma Studio** utilizado para verificar os dados (não precisa entregar print; apenas usar no desenvolvimento).

🔹 **Configuração**

* `.env` contendo `DATABASE_URL` apontando para o Postgres do Docker.  
* Scripts úteis no `package.json`, por exemplo:  
  * `"dev"` (rodar o servidor),  
  * `"seed"` (executar o seed via TSX),  
  * `"prisma:migrate"` (atalho para migrations).

🔹 **Testes com Insomnia**

* Criar um workspace do Insomnia contendo requisições para:

  * `GET /`  
  * `GET /products`  
  * `GET /products/:id` (com ao menos um id válido do seed)

---

📦 **Entrega (no SIGAA)**

1. **Link do repositório GitHub** (público), contendo:

   * código-fonte (API \+ Prisma \+ Docker Compose),  
   * `README.md` com instruções de execução (passo a passo claro: subir Docker, rodar migrations/seed, iniciar a API).

2. **Vídeo ou áudio curto (2 a 5 minutos)** explicando e demonstrando:

   * o código-fonte,  
   * containers ativos no Docker Desktop/CLI,  
   * `npx prisma studio` com os produtos,  
   * chamadas no Insomnia a `GET /` e `GET /products` (e `GET /products/:id`).

OBS: Em caso de áudio, envie prints do Docker, Prisma Studio e chamadas ao Insomnia.

---

💡 **Observações Importantes**

* **Não** use frameworks adicionais no back-end além de Express (nada de Nest por enquanto).  
* Use **Decimal** para preço (evite `float/double` por questões de precisão).  
* Garanta que a API **funcione do zero** em outra máquina com os comandos documentados no README.  
* Organização mínima de pastas (ex.: `src/`, `prisma/`, `docker/` se desejar).  
* Trate erros básicos (ex.: id inexistente retorna 404 com JSON informativo).