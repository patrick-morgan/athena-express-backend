import { DEFAULT_LLM_MODEL, gptApiCall } from "./prompts/chatgpt";
import {
  isPublicationMetadataResponse,
  publicationMetadataPrompt,
} from "./prompts/prompts";

export const fetchPublicationMetadata = async (hostname: string) => {
  const requestPayload = {
    model: DEFAULT_LLM_MODEL,
    messages: [
      {
        role: "system",
        content: publicationMetadataPrompt.replace("{hostname}", hostname),
      },
    ],
    temperature: 0,
  };

  try {
    const response = await gptApiCall(requestPayload);
    const responseData = response.data.choices[0].message.content;

    // Attempt to parse the JSON response
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseData);
      console.info("Hostname metadata JSON response:", jsonResponse);
    } catch (parseError) {
      console.error(
        "Error parsing hostname metadata JSON response:",
        parseError
      );
      throw new Error("Error parsing hostname metadata JSON response");
    }

    // Validate the JSON structure
    if (isPublicationMetadataResponse(jsonResponse)) {
      // If any fields are "NULL" replace them with null
      if (jsonResponse.date_founded === "NULL") {
        jsonResponse.date_founded = null;
      }
      if (jsonResponse.name === "NULL") {
        jsonResponse.name = null;
      }

      return jsonResponse;
    } else {
      console.error("Invalid hostname metadata JSON structure:", jsonResponse);
      throw new Error("Invalid hostname metadata JSON structure");
    }
  } catch (error) {
    console.error("Error fetching hostname metadata:", error);
    throw new Error("Error generating hostname metadata");
  }
};
