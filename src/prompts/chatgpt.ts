import axios from "axios";
import {
  buildJournalistAnalysisPrompt,
  buildPublicationAnalysisPrompt,
  JournalistAnalysisResponseSchema,
} from "./prompts";

type RequestPayloadType = {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
  temperature: number;
  response_format?: {
    type: string;
    json_schema?: object;
  };
};

export const DEFAULT_LLM_MODEL = "gpt-4o-mini";

export const buildRequestPayload = (prompt: string, jsonSchema?: object) => {
  // Define the request payload
  const requestPayload: RequestPayloadType = {
    model: DEFAULT_LLM_MODEL,
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
    temperature: 0,
  };

  if (jsonSchema) {
    requestPayload.response_format = {
      type: "json_schema",
      json_schema: jsonSchema,
    };
  }

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

export type PublicationAnalysisData = {
  averagePolarization: number;
  averageObjectivity: number;
  summaries: string[];
};

type AnalysisResponse = {
  analysis: string;
};

export const analyzePublicationBias = async (
  data: PublicationAnalysisData
): Promise<AnalysisResponse | null> => {
  const prompt = buildPublicationAnalysisPrompt(data);

  const requestPayload = buildRequestPayload(
    prompt,
    JournalistAnalysisResponseSchema
  );

  try {
    const response = await gptApiCall(requestPayload);
    const responseData = response.data.choices[0].message.content;
    console.info("Publication analysis response:", responseData);

    const jsonResponse = JSON.parse(responseData);
    return jsonResponse;
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
): Promise<AnalysisResponse | null> => {
  const prompt = buildJournalistAnalysisPrompt(data);

  const requestPayload = buildRequestPayload(
    prompt,
    JournalistAnalysisResponseSchema
  );

  try {
    const response = await gptApiCall(requestPayload);
    const responseData = response.data.choices[0].message.content;
    console.info("Journalist analysis response:", responseData);

    const jsonResponse = JSON.parse(responseData);
    return jsonResponse;
  } catch (error) {
    console.error("Error analyzing journalist analysis:", error);
    return null;
  }
};
