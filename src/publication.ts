import { gptApiCall } from "./prompts/chatgpt";
import {
  buildPublicationMetadataPrompt,
  PublicationAnalysisResponseSchema,
  PublicationMetadataResponse,
} from "./prompts/prompts";

export const fetchPublicationMetadata = async (hostname: string) => {
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

    return pubAnalysis;
  } catch (error) {
    console.error("Error fetching hostname metadata:", error);
    throw new Error("Error generating hostname metadata");
  }
};
