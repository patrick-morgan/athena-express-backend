import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function dedupePublications() {
  try {
    // Get all publications grouped by hostname
    const publicationGroups = await prisma.publication.groupBy({
      by: ["hostname"],
      _count: {
        id: true,
      },
      having: {
        id: {
          _count: {
            gt: 1,
          },
        },
      },
    });

    for (const group of publicationGroups) {
      console.log(`Deduping publications for hostname: ${group.hostname}`);

      // Get all publications for this hostname, ordered by created_at
      const publications = await prisma.publication.findMany({
        where: { hostname: group.hostname },
        orderBy: { created_at: "asc" },
        include: {
          articles: true,
        },
      });

      // Keep the oldest publication, remove others
      const [keepPublication, ...removePublications] = publications;

      for (const pubToRemove of removePublications) {
        console.log(`Removing duplicate publication: ${pubToRemove.id}`);

        // Delete associated data
        await prisma.$transaction(async (tx) => {
          // Update journalists to reference the kept publication
          await tx.journalist.updateMany({
            where: { publication: pubToRemove.id },
            data: { publication: keepPublication.id },
          });

          // Delete article_authors
          await tx.article_authors.deleteMany({
            where: {
              article_id: { in: pubToRemove.articles.map((a) => a.id) },
            },
          });

          // Delete summaries
          await tx.summary.deleteMany({
            where: {
              article_id: { in: pubToRemove.articles.map((a) => a.id) },
            },
          });

          // Delete polarization_biases
          await tx.polarization_bias.deleteMany({
            where: {
              article_id: { in: pubToRemove.articles.map((a) => a.id) },
            },
          });

          // Delete objectivity_biases
          await tx.objectivity_bias.deleteMany({
            where: {
              article_id: { in: pubToRemove.articles.map((a) => a.id) },
            },
          });

          // Delete articles
          await tx.article.deleteMany({
            where: { id: { in: pubToRemove.articles.map((a) => a.id) } },
          });

          // Delete publication_bias
          await tx.publication_bias.deleteMany({
            where: { publication: pubToRemove.id },
          });

          // Finally, delete the publication
          await tx.publication.delete({
            where: { id: pubToRemove.id },
          });
        });

        console.log(`Successfully removed publication: ${pubToRemove.id}`);
      }
    }

    console.log("Deduplication complete");
  } catch (error) {
    console.error("Error during deduplication:", error);
  } finally {
    await prisma.$disconnect();
  }
}

dedupePublications();
