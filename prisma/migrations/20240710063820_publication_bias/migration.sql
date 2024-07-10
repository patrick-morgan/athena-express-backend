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

-- AddForeignKey
ALTER TABLE "publication_bias" ADD CONSTRAINT "publication_bias_publication_fkey" FOREIGN KEY ("publication") REFERENCES "publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
