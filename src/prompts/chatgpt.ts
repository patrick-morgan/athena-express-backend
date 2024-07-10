import axios from "axios";
import {
  JournalistAnalysisResponse,
  ObjectivityBiasResponseType,
  PoliticalBiasResponseType,
  SummaryResponseType,
  articleContentReplace,
  buildJournalistAnalysisPrompt,
  buildPublicationAnalysisPrompt,
  isJournalistAnalysisResponse,
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

export const cleanJSONString = (str: string): string => {
  return str
    .replace(/[\n\r\t]/g, "")
    .replace(/\\n/g, "\\\\n")
    .replace(/\\t/g, "\\\\t");
};

export type PublicationAnalysisData = {
  averagePolarization: number;
  averageObjectivity: number;
  summaries: string[];
};

export const analyzePublicationBias = async (
  data: JournalistAnalysisData
): Promise<JournalistAnalysisResponse | null> => {
  const prompt = buildPublicationAnalysisPrompt(data);

  const requestPayload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
    temperature: 0,
  };
  try {
    const response = await gptApiCall(requestPayload);
    let responseData = response.data.choices[0].message.content;
    console.info("Publication analysis JSON response:", responseData);

    // Clean the JSON string
    responseData = cleanJSONString(responseData);

    // Attempt to parse the JSON response
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch (parseError) {
      console.error(
        "Error parsing publication analysis JSON response:",
        parseError
      );
      return null;
    }

    // Validate the JSON structure
    if (isJournalistAnalysisResponse(jsonResponse)) {
      return jsonResponse;
    } else {
      console.error(
        "Invalid publication analysis JSON structure:",
        jsonResponse
      );
      return null;
    }
  } catch (error) {
    console.error("Error analyzing publication analysis:", error);
    return null;
  }
};

export type JournalistAnalysisData = {
  averagePolarization: number;
  averageObjectivity: number;
  summaries: string[];
};

export const analyzeJournalistBias = async (
  data: JournalistAnalysisData
): Promise<JournalistAnalysisResponse | null> => {
  const prompt = buildJournalistAnalysisPrompt(data);

  const requestPayload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
    temperature: 0,
  };
  try {
    const response = await gptApiCall(requestPayload);
    let responseData = response.data.choices[0].message.content;
    console.info("Journalist analysis JSON response:", responseData);

    // Clean the JSON string
    responseData = cleanJSONString(responseData);

    // Attempt to parse the JSON response
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch (parseError) {
      console.error(
        "Error parsing journalist analysis JSON response:",
        parseError
      );
      return null;
    }

    // Validate the JSON structure
    if (isJournalistAnalysisResponse(jsonResponse)) {
      return jsonResponse;
    } else {
      console.error(
        "Invalid journalist analysis JSON structure:",
        jsonResponse
      );
      return null;
    }
  } catch (error) {
    console.error("Error analyzing journalist analysis:", error);
    return null;
  }
};
