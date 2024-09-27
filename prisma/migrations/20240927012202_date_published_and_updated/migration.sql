/*
  Warnings:

  - You are about to drop the column `date` on the `article` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "article" DROP COLUMN "date",
ADD COLUMN     "date_published" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date_updated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
