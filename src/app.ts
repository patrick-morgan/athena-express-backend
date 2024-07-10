import express, { Request, Response } from "express";
import cors from "cors";
import { PrismaClient, journalist, journalist_bias } from "@prisma/client";
import Decimal from "decimal.js";
import bodyParser from "body-parser";
import {
  JournalistAnalysisData,
  analyzeJournalistBias,
  buildRequestPayload,
  cleanJSONString,
  gptApiCall,
} from "./prompts/chatgpt";
import {
  articleContentReplace,
  isObjectivityResponse,
  isPoliticalBiasResponse,
  isPublicationMetadataResponse,
  isSummaryResponse,
  objectivityPrompt,
  politicalBiasPrompt,
  publicationMetadataPrompt,
  summaryPrompt,
} from "./prompts/prompts";
import { fetchPublicationMetadata } from "./publication";

export const prismaLocalClient = new PrismaClient();

const app = express();

app.use(cors());
app.use(bodyParser.json());

type ArticleRequestBody = {
  title: string;
  date: string;
  url: string;
  hostname: string;
  authors: string[];
  text: string;
  subtitle?: string;
};

// Create or get article
app.post(
  "/articles",
  async (req: Request<{}, {}, ArticleRequestBody>, res: Response) => {
    const { title, subtitle, date, url, text, authors, hostname } = req.body;

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

      let journalists = [];
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

      // Get article if it exists
      let article = await prismaLocalClient.article.findFirst({
        where: { url },
      });
      if (article) {
        console.info("Existing article:", article);
        return res.json(article);
      }
      // Create article
      article = await prismaLocalClient.article.create({
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
      });
      console.info("Created article:", article);
      res.json(article);
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: "Error creating article" });
    }
  }
);

// Create or get journalists biases
app.post(
  "/analyze-journalists",
  async (req: Request<{}, {}, ArticleRequestBody>, res: Response) => {
    const { title, subtitle, date, url, text, authors, hostname } = req.body;

    const publication = await prismaLocalClient.publication.findFirst({
      where: { hostname },
    });
    if (!publication) {
      return res.status(500).json({ error: "Publication not found" });
    }

    type JournalistBiasWithName = journalist_bias & { name: string };
    const outJournalistBiases: JournalistBiasWithName[] = [];

    for (const author of authors) {
      const journalist = await prismaLocalClient.journalist.findFirst({
        where: { name: author, publication: publication.id },
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
        // return res.json([{ name: journalist.name, ...existingBias }]);
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
        analysis["averagePolarization"] =
          averagePolarizationBiasScore.toNumber();
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
        analysis["averageObjectivity"] = averageObjectivityBiasScore.toNumber();
      }

      // Aggregate summaries of all articles this journalist has written
      const summaries = await prismaLocalClient.summary.findMany({
        where: { article_id: { in: articleIds } },
      });
      const summaryText: string[] = summaries.map((summary) => summary.summary);
      analysis["summaries"] = summaryText;
      console.info("Bias pre-analysis data struct", analysis);

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
    console.info("Our journalist biases", outJournalistBiases);
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

      // Clean the JSON string
      responseData = cleanJSONString(responseData);

      // Attempt to parse the JSON response
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseData);
        console.info("Objectivity JSON response:", jsonResponse);
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
