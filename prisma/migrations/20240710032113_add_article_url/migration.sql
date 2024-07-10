/*
  Warnings:

  - Added the required column `url` to the `article` table without a default value. This is not possible if the table is not empty.
  - Made the column `created_at` on table `article` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `article` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `journalist` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `journalist` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `objectivity_bias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `objectivity_bias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `polarization_bias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `polarization_bias` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `publication` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `publication` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `summary` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `summary` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "article" ADD COLUMN     "url" VARCHAR(255) NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "journalist" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "objectivity_bias" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "polarization_bias" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "publication" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "summary" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;
