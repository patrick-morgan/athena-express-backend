-- CreateTable
CREATE TABLE "article" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(255),
    "date" TIMESTAMP(6) NOT NULL,
    "text" TEXT NOT NULL,
    "publication" UUID NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_authors" (
    "article_id" UUID NOT NULL,
    "journalist_id" UUID NOT NULL,

    CONSTRAINT "article_authors_pkey" PRIMARY KEY ("article_id","journalist_id")
);

-- CreateTable
CREATE TABLE "journalist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(255) NOT NULL,
    "publication" UUID NOT NULL,

    CONSTRAINT "journalist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journalist_bias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "bias_score" DECIMAL NOT NULL,
    "rhetoric_score" DECIMAL NOT NULL,
    "num_articles_analyzed" INTEGER NOT NULL,
    "journalist" UUID NOT NULL,

    CONSTRAINT "journalist_bias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_bias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "bias_score" DECIMAL NOT NULL,
    "rhetoric_score" DECIMAL NOT NULL,
    "num_articles_analyzed" INTEGER NOT NULL,
    "publication" UUID NOT NULL,

    CONSTRAINT "publication_bias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectivity_bias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "article_id" UUID NOT NULL,
    "rhetoric_score" DECIMAL NOT NULL,
    "analysis" TEXT NOT NULL,
    "footnotes" JSONB,

    CONSTRAINT "objectivity_bias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polarization_bias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "article_id" UUID NOT NULL,
    "analysis" TEXT NOT NULL,
    "bias_score" DECIMAL NOT NULL,
    "footnotes" JSONB NOT NULL,

    CONSTRAINT "polarization_bias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(255),
    "date_founded" TIMESTAMP(6),
    "hostname" VARCHAR(255) NOT NULL,
    "owner" VARCHAR(255),

    CONSTRAINT "publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "footnotes" JSONB NOT NULL,
    "article_id" UUID NOT NULL,

    CONSTRAINT "summary_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "article" ADD CONSTRAINT "article_publication_fkey" FOREIGN KEY ("publication") REFERENCES "publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_authors" ADD CONSTRAINT "article_authors_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_authors" ADD CONSTRAINT "article_authors_journalist_id_fkey" FOREIGN KEY ("journalist_id") REFERENCES "journalist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journalist" ADD CONSTRAINT "journalist_publication_fkey" FOREIGN KEY ("publication") REFERENCES "publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journalist_bias" ADD CONSTRAINT "journalist_bias_journalist_fkey" FOREIGN KEY ("journalist") REFERENCES "journalist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_bias" ADD CONSTRAINT "publication_bias_publication_fkey" FOREIGN KEY ("publication") REFERENCES "publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectivity_bias" ADD CONSTRAINT "objectivity_bias_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polarization_bias" ADD CONSTRAINT "polarization_bias_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary" ADD CONSTRAINT "summary_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
