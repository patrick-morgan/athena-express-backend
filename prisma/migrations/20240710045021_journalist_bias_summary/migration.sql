/*
  Warnings:

  - You are about to drop the column `footnotes` on the `journalist_bias` table. All the data in the column will be lost.
  - Added the required column `summary` to the `journalist_bias` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "journalist_bias" DROP COLUMN "footnotes",
ADD COLUMN     "summary" TEXT NOT NULL;
