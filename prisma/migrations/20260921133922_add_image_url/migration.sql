-- Adiciona a coluna de imagem, obrigatoria a partir da tarefa 2.
--
-- A coluna entra com valor padrao vazio e perde o padrao em seguida, porque
-- adicionar coluna NOT NULL sem valor quebraria em tabela ja povoada. Linhas
-- antigas ficam com string vazia ate o proximo `npm run seed`, que limpa e
-- repovoa o catalogo.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "imageUrl" VARCHAR(2048) NOT NULL DEFAULT '';
ALTER TABLE "products" ALTER COLUMN "imageUrl" DROP DEFAULT;
