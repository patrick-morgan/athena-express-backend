/*
  Warnings:

  - Made the column `article_id` on table `summary` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "summary" DROP CONSTRAINT "summary_article_id_fkey";

-- AlterTable
ALTER TABLE "summary" ALTER COLUMN "article_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "summary" ADD CONSTRAINT "summary_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
