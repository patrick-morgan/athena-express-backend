/*
  Warnings:

  - Added the required column `publication` to the `journalist` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "journalist" ADD COLUMN     "publication" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "journalist" ADD CONSTRAINT "journalist_publication_fkey" FOREIGN KEY ("publication") REFERENCES "publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
