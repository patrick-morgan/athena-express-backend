import { prismaLocalClient } from "./app";
import { gptApiCall } from "./prompts/chatgpt";
import {
  buildPublicationMetadataPrompt,
  PublicationAnalysisResponseSchema,
  PublicationMetadataResponse,
  PublicationMetadataSchema,
} from "./prompts/prompts";

export const getOrCreatePublication = async (hostname: string) => {
  // First, check if the publication already exists in the database
  let publication = await prismaLocalClient.publication.findFirst({
    where: { hostname },
  });
  console.info("Publication found in database:", publication);

  if (publication && publication.name) {
    console.info("Publication has name so returning");
    return publication;
  }

  // If publication doesn't have a name yet, run prompt
  const prompt = buildPublicationMetadataPrompt(hostname);

  const requestPayload = {
    prompt,
    zodSchema: PublicationMetadataSchema,
    propertyName: "publication_metadata",
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

    // If publication already exists, update
    if (publication) {
      publication = await prismaLocalClient.publication.update({
        where: { id: publication.id },
        data: {
          // hostname,
          name: pubAnalysis.name,
          date_founded: pubAnalysis.date_founded
            ? new Date(pubAnalysis.date_founded)
            : null,
        },
      });
      console.log("Updated publication", publication);
    } else {
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
      console.log("Created new publication", publication);
    }

    return publication;
  } catch (error) {
    console.error("Error fetching hostname metadata:", error);
    throw new Error("Error generating hostname metadata");
  }
};
