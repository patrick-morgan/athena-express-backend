import { PrismaClient, journalist_bias } from "@prisma/client";
import bodyParser from "body-parser";
import cors from "cors";
import Decimal from "decimal.js";
import express, { Request, Response } from "express";
import { getHostname } from "./parsers/helpers";
import { getParser } from "./parsers/parsers";
import {
  JournalistAnalysisData,
  PublicationAnalysisData,
  analyzeJournalistBias,
  analyzePublicationBias,
  buildRequestPayload,
  cleanJSONString,
  gptApiCall,
} from "./prompts/chatgpt";
import {
  articleContentReplace,
  isObjectivityResponse,
  isPoliticalBiasResponse,
  isSummaryResponse,
  objectivityPrompt,
  politicalBiasPrompt,
  summaryPrompt,
} from "./prompts/prompts";
import { fetchPublicationMetadata } from "./publication";
import { ArticleData } from "./types";
export const prismaLocalClient = new PrismaClient();

const app = express();

app.use(cors());
app.use(bodyParser.json());

type CreateArticlePayload = {
  url: string;
  html: string;
};

// Create or get article
app.post(
  "/articles",
  async (req: Request<{}, {}, CreateArticlePayload>, res: Response) => {
    const { url, html } = req.body;

    // Get article if it exists
    const existingArticle = await prismaLocalClient.article.findFirst({
      where: { url },
      include: {
        article_authors: true,
      },
    });

    let title, subtitle, date, text, authors, hostname;
    if (existingArticle) {
      title = existingArticle.title;
      subtitle = existingArticle.subtitle;
      date = existingArticle.date;
      text = existingArticle.text;
      hostname = getHostname(url);
      const author_ids = existingArticle.article_authors.map(
        (author) => author.journalist_id
      );
      const authorObjects = await prismaLocalClient.journalist.findMany({
        where: { id: { in: author_ids } },
      });
      authors = authorObjects.map((author) => author.name);
    } else {
      const parser = getParser(url, html);
      const articleData: ArticleData = await parser.parse();
      title = articleData.title;
      subtitle = articleData.subtitle;
      date = articleData.date;
      text = articleData.text;
      authors = articleData.authors;
      hostname = articleData.hostname;
    }

    const journalists = [];
    let outArticle = null;

    if (!text) {
      console.error("Error parsing article");
      return res.status(500).json({ error: "Error parsing article" });
    }

    try {
      // Get publication by hostname
      let publication = await prismaLocalClient.publication.findFirst({
        where: { hostname },
      });
      console.info("Existing publication:", publication);

      // If not found, create a new publication
      if (!publication) {
        const metadata = await fetchPublicationMetadata(hostname);
        console.info("Publication metadata:", metadata);

        if (metadata.date_founded !== null) {
          const [month, day, year] = metadata.date_founded.split("/");
          metadata.date_founded = `${year}-${month}-${day}`;
        }

        publication = await prismaLocalClient.publication.create({
          data: {
            hostname,
            name: metadata.name,
            date_founded: metadata.date_founded
              ? new Date(metadata.date_founded)
              : null,
            // owner: metadata.owner,
          },
        });
        console.info("Created publication:", publication);
      }

      // Get journalists by name/publication
      for (let i = 0; i < authors.length; i++) {
        let journalist = await prismaLocalClient.journalist.findFirst({
          where: { name: authors[i], publication: publication.id },
        });
        console.info("Existing journalist:", journalist);
        // If not found, create a new journalist
        if (!journalist) {
          journalist = await prismaLocalClient.journalist.create({
            data: {
              name: authors[i],
              publication: publication.id,
            },
          });
          console.info("Created journalist:", journalist);
        }
        journalists.push(journalist);
      }

      if (existingArticle) {
        console.info("Existing article:", existingArticle);
        outArticle = existingArticle;
      } else {
        // Create article
        const newArticle = await prismaLocalClient.article.create({
          data: {
            title,
            subtitle,
            date: new Date(date),
            url,
            text,
            publication: publication.id,
            // summary: { connect: { id: summaryId } },
            // polarization_bias: { connect: { id: polarizationBiasId } },
            // objectivity_bias: { connect: { id: objectivityBiasId } },
            article_authors: {
              create: journalists.map((journalist) => ({
                journalist_id: journalist.id,
              })),
            },
          },
          // include: {
          //   article_authors: true,
          // },
        });
        outArticle = newArticle;
        console.info("Created article:", newArticle);
      }

      res.json({
        article: outArticle,
        publication,
        journalists,
      });
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: "Error creating article" });
    }
  }
);

type PublicationBiasPayload = {
  publicationId: string;
};

// Create or get publication bias
app.post(
  "/analyze-publication",
  async (req: Request<{}, {}, PublicationBiasPayload>, res: Response) => {
    const { publicationId } = req.body;
    const publication = await prismaLocalClient.publication.findFirst({
      where: { id: publicationId },
    });
    if (!publication) {
      return res.status(500).json({ error: "Publication not found" });
    }
    // article_ids publication has written
    const articles = await prismaLocalClient.article.findMany({
      where: { publication: publicationId },
    });
    // If publication bias already exists with same # articles analyzed, return it
    const existingBias = await prismaLocalClient.publication_bias.findFirst({
      where: {
        publication: publicationId,
        num_articles_analyzed: articles.length,
      },
    });
    if (existingBias) {
      console.info("Existing publication bias:", existingBias);
      return res.json({
        publication,
        analysis: existingBias,
      });
    }
    // Create publication bias
    const articleIds = articles.map((article) => article.id);
    const analysis: PublicationAnalysisData = {
      averagePolarization: 0.5,
      averageObjectivity: 0.5,
      summaries: [],
    };
    const polarizationBiases =
      await prismaLocalClient.polarization_bias.findMany({
        where: { article_id: { in: articleIds } },
      });

    if (polarizationBiases.length > 0) {
      let totalPolarizationBiasScore = new Decimal(0);
      polarizationBiases.forEach((bias) => {
        totalPolarizationBiasScore = totalPolarizationBiasScore.plus(
          bias.bias_score
        );
      });
      const averagePolarizationBiasScore = totalPolarizationBiasScore.dividedBy(
        polarizationBiases.length
      );
      // Round to 1 decimal place
      analysis["averagePolarization"] = parseFloat(
        averagePolarizationBiasScore.toNumber().toFixed(1)
      );
    }

    const objectivityBiases = await prismaLocalClient.objectivity_bias.findMany(
      {
        where: { article_id: { in: articleIds } },
      }
    );
    if (objectivityBiases.length > 0) {
      let totalObjectivityBiasScore = new Decimal(0);
      objectivityBiases.forEach((bias) => {
        totalObjectivityBiasScore = totalObjectivityBiasScore.plus(
          bias.rhetoric_score
        );
      });
      const averageObjectivityBiasScore = totalObjectivityBiasScore.dividedBy(
        objectivityBiases.length
      );
      analysis["averageObjectivity"] = parseFloat(
        averageObjectivityBiasScore.toNumber().toFixed(1)
      );
    }

    // Take 10 most recent summaries
    const summaries = await prismaLocalClient.summary.findMany({
      where: { article_id: { in: articleIds } },
      orderBy: {
        created_at: "desc",
      },
      take: 10,
    });
    const summaryText: string[] = summaries.map((summary) => summary.summary);
    analysis["summaries"] = summaryText;
    console.info("Publication bias pre-analysis data struct", analysis);

    // Get publication analysis
    const publicationAnalysis = await analyzePublicationBias(analysis);
    if (!publicationAnalysis) {
      return res
        .status(500)
        .json({ error: "Error analyzing publication bias" });
    }
    // Construct new analysis
    const newPublicationBias = await prismaLocalClient.publication_bias.create({
      data: {
        publication: publicationId,
        num_articles_analyzed: articles.length,
        rhetoric_score: analysis.averageObjectivity,
        bias_score: analysis.averagePolarization,
        summary: publicationAnalysis.analysis,
      },
    });
    console.info("Created publication bias:", newPublicationBias);
    res.json({ publication, analysis: newPublicationBias });
  }
);

type AnalyzeJournalistsPayload = {
  articleId: string;
};
// Create or get journalists biases
app.post(
  "/analyze-journalists",
  async (req: Request<{}, {}, AnalyzeJournalistsPayload>, res: Response) => {
    const { articleId } = req.body;
    // Get article by id
    const article = await prismaLocalClient.article.findFirst({
      where: { id: articleId },
      include: {
        article_authors: true,
      },
    });
    if (!article) {
      console.error("Error analyzing journalists -- Article not found");
      return res.status(500).json({ error: "Article not found" });
    }
    const { title, subtitle, date, url, text, article_authors } = article;
    const hostname = getHostname(url);
    const authors = article_authors.map((author) => author.journalist_id);

    const publication = await prismaLocalClient.publication.findFirst({
      where: { hostname },
    });
    if (!publication) {
      return res.status(500).json({ error: "Publication not found" });
    }

    type JournalistBiasWithName = journalist_bias & { name: string };
    const outJournalistBiases: JournalistBiasWithName[] = [];

    for (const journalistId of authors) {
      const journalist = await prismaLocalClient.journalist.findFirst({
        where: { id: journalistId },
        include: { article_authors: true },
      });
      if (!journalist) {
        return res.status(500).json({ error: "Journalist not found" });
      }
      // Number of articles this journalist has written
      const numArticlesWritten = journalist.article_authors.length;
      // Get bias if num articles written is same as what we have already analyzed (hence no changes to re-analyze)
      const existingBias = await prismaLocalClient.journalist_bias.findFirst({
        where: {
          journalist: journalist.id,
          num_articles_analyzed: numArticlesWritten,
        },
      });
      if (existingBias) {
        console.info("Existing journalist bias:", existingBias);
        outJournalistBiases.push({ name: journalist.name, ...existingBias });
        continue;
      }
      // Create journalist bias
      // Aggregate all article_ids this journalist has written
      const articleIds = journalist.article_authors.map(
        (article) => article.article_id
      );
      // Average bias score of all articles this journalist has written
      const analysis: JournalistAnalysisData = {
        // journalist: journalist.id,
        averagePolarization: 0.5,
        averageObjectivity: 0.5,
        summaries: [],
      };

      const polarizationBiases =
        await prismaLocalClient.polarization_bias.findMany({
          where: { article_id: { in: articleIds } },
        });

      if (polarizationBiases.length > 0) {
        let totalPolarizationBiasScore = new Decimal(0);
        polarizationBiases.forEach((bias) => {
          totalPolarizationBiasScore = totalPolarizationBiasScore.plus(
            bias.bias_score
          );
        });
        const averagePolarizationBiasScore =
          totalPolarizationBiasScore.dividedBy(polarizationBiases.length);
        analysis["averagePolarization"] = parseFloat(
          averagePolarizationBiasScore.toNumber().toFixed(1)
        );
      }

      const objectivityBiases =
        await prismaLocalClient.objectivity_bias.findMany({
          where: { article_id: { in: articleIds } },
        });
      if (objectivityBiases.length > 0) {
        let totalObjectivityBiasScore = new Decimal(0);
        objectivityBiases.forEach((bias) => {
          totalObjectivityBiasScore = totalObjectivityBiasScore.plus(
            bias.rhetoric_score
          );
        });
        const averageObjectivityBiasScore = totalObjectivityBiasScore.dividedBy(
          objectivityBiases.length
        );
        analysis["averageObjectivity"] = parseFloat(
          averageObjectivityBiasScore.toNumber().toFixed(1)
        );
      }

      // Aggregate summaries of all articles this journalist has written
      const summaries = await prismaLocalClient.summary.findMany({
        where: { article_id: { in: articleIds } },
      });
      const summaryText: string[] = summaries.map((summary) => summary.summary);
      analysis["summaries"] = summaryText;
      console.info("Journalist bias pre-analysis data struct", analysis);

      // Get journalist analysis
      const journalistAnalysis = await analyzeJournalistBias(analysis);
      if (!journalistAnalysis) {
        return res
          .status(500)
          .json({ error: "Error analyzing journalist bias" });
      }
      // Construct new analysis
      const newJournalistBias = await prismaLocalClient.journalist_bias.create({
        data: {
          journalist: journalist.id,
          num_articles_analyzed: numArticlesWritten,
          rhetoric_score: analysis.averageObjectivity,
          bias_score: analysis.averagePolarization,
          summary: journalistAnalysis.analysis,
        },
      });
      console.info("Created journalist bias:", newJournalistBias);
      outJournalistBiases.push({
        name: journalist.name,
        ...newJournalistBias,
      });
    }
    console.info("Out journalist biases", outJournalistBiases);
    res.json(outJournalistBiases);
  }
);

type ArticlePayload = {
  id: string;
  text: string;
};

app.post(
  "/generate-summary",
  async (req: Request<{}, {}, ArticlePayload>, res: Response) => {
    const { text, id: articleId } = req.body;
    const requestPayload = buildRequestPayload(summaryPrompt);
    try {
      // Get article summary if it exists
      const existingSummary = await prismaLocalClient.summary.findFirst({
        where: { article_id: articleId },
      });
      if (existingSummary) {
        console.info("Existing article summary:", existingSummary);
        return res.json(existingSummary);
      }

      // Create article summary
      // Update the article content in the request payload
      requestPayload.messages[0].content =
        requestPayload.messages[0].content.replace(articleContentReplace, text);

      const response = await gptApiCall(requestPayload);
      let responseData = response.data.choices[0].message.content;
      console.info("Summary LLM response:", responseData);

      // Clean the JSON string
      responseData = cleanJSONString(responseData);

      // Attempt to parse the JSON response
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseData);
        console.info("Summary JSON response:", jsonResponse);
      } catch (parseError) {
        console.error("Error parsing summary JSON response:", parseError);
        return res
          .status(500)
          .json({ error: "Error parsing summary JSON response" });
      }

      // Validate the JSON structure
      if (isSummaryResponse(jsonResponse)) {
        // Create the article summary
        const newArticleSummary = await prismaLocalClient.summary.create({
          data: {
            article_id: articleId,
            summary: jsonResponse.summary,
            footnotes: jsonResponse.footnotes,
          },
        });
        console.info("Created article summary:", newArticleSummary);
        return res.json(newArticleSummary);
      } else {
        console.error("Invalid summary JSON structure:", jsonResponse);
        return res
          .status(500)
          .json({ error: "Invalid summary JSON structure" });
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      return res.status(500).json({ error: "Error generating summary" });
    }
  }
);

app.post(
  "/analyze-political-bias",
  async (req: Request<{}, {}, ArticlePayload>, res: Response) => {
    const { id: articleId, text } = req.body;
    const requestPayload = buildRequestPayload(politicalBiasPrompt);
    try {
      // Get article political bias if it exists
      const existingBias = await prismaLocalClient.polarization_bias.findFirst({
        where: { article_id: articleId },
      });
      if (existingBias) {
        console.info("Existing article political bias:", existingBias);
        return res.json(existingBias);
      }

      // Create article political bias
      // Update the article content in the request payload
      requestPayload.messages[0].content =
        requestPayload.messages[0].content.replace(articleContentReplace, text);

      const response = await gptApiCall(requestPayload);
      let responseData = response.data.choices[0].message.content;
      console.info("Political bias LLM response:", responseData);

      // Clean the JSON string
      responseData = cleanJSONString(responseData);

      // Attempt to parse the JSON response
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseData);
        console.info("Political bias JSON response:", jsonResponse);
      } catch (parseError) {
        console.error(
          "Error parsing political bias JSON response:",
          parseError
        );
        return res
          .status(500)
          .json({ error: "Error parsing political bias JSON response" });
      }

      // Validate the JSON structure
      if (isPoliticalBiasResponse(jsonResponse)) {
        // Create article political bias
        const newArticleBias = await prismaLocalClient.polarization_bias.create(
          {
            data: {
              article_id: articleId,
              analysis: jsonResponse.analysis,
              bias_score: jsonResponse.bias_score,
              footnotes: jsonResponse.footnotes,
            },
          }
        );
        console.info("Created article political bias:", newArticleBias);
        return res.json(newArticleBias);
      } else {
        console.error("Invalid political bias JSON structure:", jsonResponse);
        return res
          .status(500)
          .json({ error: "Invalid political bias JSON structure" });
      }
    } catch (error) {
      console.error("Error analyzing political bias:", error);
      return res.status(500).json({ error: "Error analyzing political bias" });
    }
  }
);

app.post(
  "/analyze-objectivity",
  async (req: Request<{}, {}, ArticlePayload>, res: Response) => {
    const { id: articleId, text } = req.body;
    const requestPayload = buildRequestPayload(objectivityPrompt);
    try {
      // Get article objectivity if it exists
      const existingBias = await prismaLocalClient.objectivity_bias.findFirst({
        where: { article_id: articleId },
      });
      if (existingBias) {
        console.info("Existing article objectivity:", existingBias);
        return res.json(existingBias);
      }
      // Create article objectivity
      // Update the article content in the request payload
      requestPayload.messages[0].content =
        requestPayload.messages[0].content.replace(articleContentReplace, text);

      const response = await gptApiCall(requestPayload);
      let responseData = response.data.choices[0].message.content;
      console.info("Objectivity JSON response:", responseData);

      // Clean the JSON string
      responseData = cleanJSONString(responseData);

      // Attempt to parse the JSON response
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseData);
      } catch (parseError) {
        console.error("Error parsing objectivity JSON response:", parseError);
        return res
          .status(500)
          .json({ error: "Error parsing objectivity JSON response" });
      }

      // Validate the JSON structure
      if (isObjectivityResponse(jsonResponse)) {
        // Create article objectivity
        const newArticleBias = await prismaLocalClient.objectivity_bias.create({
          data: {
            article_id: articleId,
            analysis: jsonResponse.analysis,
            rhetoric_score: jsonResponse.rhetoric_score,
            footnotes: jsonResponse.footnotes,
          },
        });
        console.info("Created article objectivity:", newArticleBias);
        return res.json(newArticleBias);
      } else {
        console.error("Invalid objectivity JSON structure:", jsonResponse);
        return res
          .status(500)
          .json({ error: "Invalid objectivity JSON structure" });
      }
    } catch (error) {
      console.error("Error analyzing objectivity:", error);
      return res.status(500).json({ error: "Error analyzing objectivity" });
    }
  }
);

// Get all articles
app.get("/articles", async (req, res) => {
  try {
    const articles = await prismaLocalClient.article.findMany({
      include: {
        article_authors: true,
        // publication_article_publicationTopublication: true,
        summary: true,
        polarization_bias: true,
        objectivity_bias: true,
      },
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: "Error fetching articles" });
  }
});

// Get a single article by ID
app.get("/articles/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const article = await prismaLocalClient.article.findUnique({
      where: { id },
      include: {
        article_authors: true,
        // article_publicationTopublication: true,
        summary: true,
        polarization_bias: true,
        objectivity_bias: true,
      },
    });
    res.json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Error fetching article" });
  }
});

// Update an article by ID
app.put("/articles/:id", async (req, res) => {
  const { id } = req.params;
  const {
    title,
    subtitle,
    date,
    text,
    authors,
    publicationId,
    summaryId,
    polarizationBiasId,
    objectivityBiasId,
  } = req.body;

  try {
    const article = await prismaLocalClient.article.update({
      where: { id },
      data: {
        title,
        subtitle,
        date: new Date(date),
        text,
        publication: publicationId,
        summary: { connect: { id: summaryId } },
        polarization_bias: { connect: { id: polarizationBiasId } },
        objectivity_bias: { connect: { id: objectivityBiasId } },
        article_authors: {
          deleteMany: {},
          create: authors.map((authorId: string) => ({
            journalist_id: authorId,
          })),
        },
      },
    });
    res.json(article);
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(500).json({ error: "Error updating article" });
  }
});

// Delete an article by ID
app.delete("/articles/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prismaLocalClient.article.delete({
      where: { id },
    });
    res.json({ message: "Article deleted" });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Error deleting article" });
  }
});

type PublicationMetadataRequestBody = {
  hostname: string;
};

// Route to get publication metadata
app.post(
  "/get-publication-metadata",
  async (
    req: Request<{}, {}, PublicationMetadataRequestBody>,
    res: Response
  ) => {
    const { hostname } = req.body;
    try {
      const metadata = await fetchPublicationMetadata(hostname);
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching publication metadata:", error);
      res.status(500).json({ error: "Error fetching publication metadata" });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.info(`Server is running on port ${PORT}`);
});
