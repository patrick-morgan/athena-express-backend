import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";
import { buildRequestPayload, gptApiCall } from "./prompts/chatgpt";
import {
  articleContentReplace,
  isSummaryResponse,
  summaryPrompt,
} from "./prompts/prompts";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Create an article
app.post("/articles", async (req, res) => {
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
    const article = await prisma.article.create({
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
          create: authors.map((authorId: string) => ({
            journalist_id: authorId,
          })),
        },
      },
    });
    res.json(article);
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ error: "Error creating article" });
  }
});

// Get all articles
app.get("/articles", async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      include: {
        article_authors: true,
        publication_article_publicationTopublication: true,
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
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        article_authors: true,
        publication_article_publicationTopublication: true,
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
    const article = await prisma.article.update({
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
    await prisma.article.delete({
      where: { id },
    });
    res.json({ message: "Article deleted" });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Error deleting article" });
  }
});

// Route to generate summary
app.post("/generate-summary", async (req, res) => {
  const { articleContent } = req.body;
  const requestPayload = buildRequestPayload(summaryPrompt);
  try {
    // Update the article content in the request payload
    requestPayload.messages[0].content =
      requestPayload.messages[0].content.replace(
        articleContentReplace,
        articleContent
      );

    const response = await gptApiCall(requestPayload);
    const responseData = response.data.choices[0].message.content;

    // Attempt to parse the JSON response
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch (parseError) {
      console.error("Error parsing summary JSON response:", parseError);
      return res
        .status(500)
        .json({ error: "Error parsing summary JSON response" });
    }

    // Validate the JSON structure
    if (isSummaryResponse(jsonResponse)) {
      return res.json(jsonResponse);
    } else {
      console.error("Invalid summary JSON structure:", jsonResponse);
      return res.status(500).json({ error: "Invalid summary JSON structure" });
    }
  } catch (error) {
    console.error("Error generating summary:", error);
    return res.status(500).json({ error: "Error generating summary" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
