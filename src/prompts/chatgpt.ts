import axios from "axios";
import {
  buildJournalistAnalysisPrompt,
  buildPublicationAnalysisPrompt,
  JournalistAnalysisResponse,
  JournalistAnalysisResponseSchema,
  PublicationAnalysisResponse,
  PublicationAnalysisResponseSchema,
} from "./prompts";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";

export const DEFAULT_LLM_MODEL = "gpt-4o-mini";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// type RequestPayloadType = {
//   model: string;
//   messages: {
//     role: string;
//     content: string;
//   }[];
//   temperature: number;
//   response_format?: {
//     type: string;
//     json_schema?: object;
//   };
// };

// export const buildRequestPayload = (
//   prompt: string,
//   zodSchema: z.ZodType,
//   propertyName: string
// ) => {
//   const requestPayload: RequestPayloadType = {
//     model: DEFAULT_LLM_MODEL,
//     messages: [
//       {
//         role: "system",
//         content: prompt,
//       },
//     ],
//     temperature: 0,
//     response_format: zodResponseFormat(zodSchema, propertyName),
//   };

//   return requestPayload;
// };

// export const gptApiCall = async (requestPayload: RequestPayloadType) => {
//   const response = await axios.post(
//     "https://api.openai.com/v1/chat/completions",
//     requestPayload,
//     {
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//       },
//     }
//   );
//   return response;
// };

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
  const format = zodResponseFormat(zodSchema, propertyName);
  console.log("FISH ZOD RESPONSE SCHEMA", format);
  console.log(JSON.stringify(format.json_schema.schema));
  console.log(format.json_schema.schema);
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
  // const response = completion.choices[0].message.parsed;
  // return response;
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

  // const requestPayload = buildRequestPayload(
  //   prompt,
  //   PublicationAnalysisResponseSchema,
  //   "publication_analysis"
  // );
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

  // const requestPayload = buildRequestPayload(
  //   prompt,
  //   JournalistAnalysisResponseSchema,
  //   "journalist_analysis"
  // );
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
