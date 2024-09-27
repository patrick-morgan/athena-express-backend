import { prismaLocalClient } from "./app";
import { gptApiCall } from "./prompts/chatgpt";
import {
  buildPublicationMetadataPrompt,
  PublicationAnalysisResponseSchema,
  PublicationMetadataResponse,
} from "./prompts/prompts";

export const fetchPublicationMetadata = async (hostname: string) => {
  // First, check if the publication already exists in the database
  let publication = await prismaLocalClient.publication.findFirst({
    where: { hostname },
  });

  if (publication) {
    console.info("Publication found in database:", publication);
    return publication;
  }

  // If not found in the database, fetch metadata using GPT
  const prompt = buildPublicationMetadataPrompt(hostname);

  const requestPayload = {
    prompt,
    zodSchema: PublicationAnalysisResponseSchema,
    propertyName: "publication_analysis",
  };

  try {
    const response = await gptApiCall(requestPayload);
    const pubAnalysis: PublicationMetadataResponse =
      response.choices[0].message.parsed;

    console.info("Hostname metadata JSON response:", pubAnalysis);

    // If any fields are "" replace them with null
    if (pubAnalysis.date_founded === "") {
      pubAnalysis.date_founded = null;
    }
    if (pubAnalysis.name === "") {
      pubAnalysis.name = null;
    }

    // Create a new publication in the database
    publication = await prismaLocalClient.publication.create({
      data: {
        hostname,
        name: pubAnalysis.name,
        date_founded: pubAnalysis.date_founded
          ? new Date(pubAnalysis.date_founded)
          : null,
      },
    });

    console.info("New publication created in database:", publication);
    return publication;
  } catch (error) {
    console.error("Error fetching hostname metadata:", error);
    throw new Error("Error generating hostname metadata");
  }
};
