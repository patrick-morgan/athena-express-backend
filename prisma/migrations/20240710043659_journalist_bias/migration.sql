/*
  Warnings:

  - Made the column `footnotes` on table `polarization_bias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `footnotes` on table `summary` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "polarization_bias" ALTER COLUMN "footnotes" SET NOT NULL;

-- AlterTable
ALTER TABLE "summary" ALTER COLUMN "footnotes" SET NOT NULL;

-- CreateTable
CREATE TABLE "journalist_bias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bias_score" DECIMAL NOT NULL,
    "rhetoric_score" DECIMAL NOT NULL,
    "footnotes" JSONB NOT NULL,
    "num_articles_analyzed" INTEGER NOT NULL,
    "journalist" UUID NOT NULL,

    CONSTRAINT "journalist_bias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "journalist_bias" ADD CONSTRAINT "journalist_bias_journalist_fkey" FOREIGN KEY ("journalist") REFERENCES "journalist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
