import axios from "axios";
import {
  ObjectivityBiasResponseType,
  PoliticalBiasResponseType,
  SummaryResponseType,
  articleContentReplace,
  isObjectivityResponse,
  isPoliticalBiasResponse,
  isSummaryResponse,
  objectivityPrompt,
  politicalBiasPrompt,
  summaryPrompt,
} from "./prompts";

type RequestPayloadType = {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
  temperature: number;
};

export const buildRequestPayload = (prompt: string) => {
  // Define the request payload
  const requestPayload: RequestPayloadType = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
    temperature: 0,
  };
  return requestPayload;
};

export const gptApiCall = async (requestPayload: RequestPayloadType) => {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    requestPayload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );
  return response;
};

export const analyzePoliticalBias = async (
  articleContent: string
): Promise<PoliticalBiasResponseType | null> => {
  const requestPayload = buildRequestPayload(politicalBiasPrompt);
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
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch (parseError) {
      console.error("Error parsing political bias JSON response:", parseError);
      return null;
    }

    // Validate the JSON structure
    if (isPoliticalBiasResponse(jsonResponse)) {
      return jsonResponse;
    } else {
      console.error("Invalid political bias JSON structure:", jsonResponse);
      return null;
    }
  } catch (error) {
    console.error("Error analyzing political bias:", error);
    return null;
  }
};

export const analyzeObjectivity = async (
  articleContent: string
): Promise<ObjectivityBiasResponseType | null> => {
  const requestPayload = buildRequestPayload(objectivityPrompt);
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
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch (parseError) {
      console.error("Error parsing objectivity JSON response:", parseError);
      return null;
    }

    // Validate the JSON structure
    if (isObjectivityResponse(jsonResponse)) {
      return jsonResponse;
    } else {
      console.error("Invalid objectivity JSON structure:", jsonResponse);
      return null;
    }
  } catch (error) {
    console.error("Error analyzing objectivity:", error);
    return null;
  }
};
