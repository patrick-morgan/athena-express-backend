import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildJournalistAnalysisPrompt,
  buildPublicationAnalysisPrompt,
  JournalistAnalysisResponse,
  JournalistAnalysisResponseSchema,
  PublicationAnalysisResponse,
  PublicationAnalysisResponseSchema,
} from "./prompts";

export const DEFAULT_LLM_MODEL = "gpt-4o-mini";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type RequestPayloadType = {
  prompt: string;
  zodSchema: z.ZodType;
  propertyName: string;
};

export const gptApiCall = async ({
  prompt,
  zodSchema,
  propertyName,
}: RequestPayloadType) => {
  const completion = openai.beta.chat.completions.parse({
    model: DEFAULT_LLM_MODEL,
    messages: [
      { role: "system", content: prompt },
      // { role: "user", content: "Alice and Bob are going to a science fair on Friday." },
    ],
    temperature: 0,
    response_format: zodResponseFormat(zodSchema, propertyName),
  });
  return completion;
};

export type PublicationAnalysisData = {
  averagePolarization: number;
  averageObjectivity: number;
  summaries: string[];
};

export const analyzePublicationBias = async (
  data: PublicationAnalysisData
): Promise<PublicationAnalysisResponse | null> => {
  const prompt = buildPublicationAnalysisPrompt(data);
  const requestPayload = {
    prompt,
    zodSchema: PublicationAnalysisResponseSchema,
    propertyName: "publication_analysis",
  };

  try {
    const response = await gptApiCall(requestPayload);
    const responseData: PublicationAnalysisResponse =
      response.choices[0].message.parsed;
    console.info("Publication analysis response:", responseData);

    return responseData;
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
    prompt,
    zodSchema: JournalistAnalysisResponseSchema,
    propertyName: "journalist_analysis",
  };

  try {
    const response = await gptApiCall(requestPayload);
    const responseData: JournalistAnalysisResponse =
      response.choices[0].message.parsed;
    console.info("Journalist analysis response:", responseData);

    return responseData;
  } catch (error) {
    console.error("Error analyzing journalist analysis:", error);
    return null;
  }
};
