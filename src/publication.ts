import { gptApiCall } from "./prompts/chatgpt";
import {
  PublicationAnalysisResponse,
  PublicationAnalysisResponseSchema,
  publicationMetadataPrompt,
  PublicationMetadataResponse,
} from "./prompts/prompts";

export const fetchPublicationMetadata = async (hostname: string) => {
  const prompt = publicationMetadataPrompt.replace("{hostname}", hostname);

  // const requestPayload = buildRequestPayload(
  //   prompt,
  //   PublicationAnalysisResponseSchema
  // );
  // const requestPayload = buildRequestPayload(
  //   prompt,
  //   PublicationAnalysisResponseSchema,
  //   "publication_analysis"
  // );

  // const requestPayload = {
  //   model: DEFAULT_LLM_MODEL,
  //   messages: [
  //     {
  //       role: "system",
  //       content: publicationMetadataPrompt.replace("{hostname}", hostname),
  //     },
  //   ],
  //   temperature: 0,
  // };

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
    // Attempt to parse the JSON response
    // let jsonResponse: any;
    // try {
    //   jsonResponse = JSON.parse(responseData);
    //   console.info("Hostname metadata JSON response:", jsonResponse);
    // } catch (parseError) {
    //   console.error(
    //     "Error parsing hostname metadata JSON response:",
    //     parseError
    //   );
    //   throw new Error("Error parsing hostname metadata JSON response");
    // }

    // If any fields are "NULL" replace them with null
    if (pubAnalysis.date_founded === "NULL") {
      pubAnalysis.date_founded = null;
    }
    if (pubAnalysis.name === "NULL") {
      pubAnalysis.name = null;
    }

    return pubAnalysis;
  } catch (error) {
    console.error("Error fetching hostname metadata:", error);
    throw new Error("Error generating hostname metadata");
  }
};
