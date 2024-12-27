import { PrismaClient } from "@prisma/client";
import { cleanArticleText } from "../utils/textCleaner";

const prisma = new PrismaClient();

async function cleanAllArticleText() {
  try {
    // Get total count first
    const totalArticles = await prisma.article.count({
      where: {
        text: {
          not: null,
        },
      },
    });

    console.log(`Found ${totalArticles} articles to clean\n`);

    let processedCount = 0;
    let totalCharsSaved = 0;
    const batchSize = 50; // Process 50 articles at a time

    // Process articles in batches
    while (processedCount < totalArticles) {
      const articles = await prisma.article.findMany({
        take: batchSize,
        skip: processedCount,
        where: {
          text: {
            not: null,
          },
        },
        select: {
          id: true,
          text: true,
        },
      });

      // Process each article in the batch
      for (const article of articles) {
        if (!article.text) continue;

        const originalLength = article.text.length;
        const cleanedText = cleanArticleText(article.text);
        const charsSaved = originalLength - cleanedText.length;

        // Update the article
        await prisma.article.update({
          where: { id: article.id },
          data: { text: cleanedText },
        });

        totalCharsSaved += charsSaved;
        processedCount++;

        // Log progress every 10 articles
        if (processedCount % 10 === 0) {
          const percentComplete = (
            (processedCount / totalArticles) *
            100
          ).toFixed(2);
          console.log(
            `Processed ${processedCount}/${totalArticles} articles (${percentComplete}%)`
          );
          console.log(`Total characters saved so far: ${totalCharsSaved}`);
        }
      }
    }

    console.log("\nFinal Results:");
    console.log(`Total articles processed: ${processedCount}`);
    console.log(`Total characters saved: ${totalCharsSaved}`);
    console.log(
      `Average characters saved per article: ${(
        totalCharsSaved / processedCount
      ).toFixed(2)}`
    );
  } catch (error) {
    console.error("Error cleaning article text:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleaning process
console.log("Starting article text cleaning process...");
cleanAllArticleText().then(() => {
  console.log("Finished cleaning article text");
});
