// prompts.ts
import { z } from "zod";
import { JournalistAnalysisData, PublicationAnalysisData } from "./chatgpt";

export const articleContentReplace = "[Insert article content here]";

export const SummaryResponseSchema = z.object({
  summary: z.string(),
  footnotes: z.object({}).catchall(z.string()),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const PoliticalBiasResponseSchema = z.object({
  bias_score: z.number(),
  analysis: z.string(),
  footnotes: z.object({}).catchall(z.string()),
});
export type PoliticalBiasResponse = z.infer<typeof PoliticalBiasResponseSchema>;

export const ObjectivityBiasResponseSchema = z.object({
  rhetoric_score: z.number(),
  analysis: z.string(),
  footnotes: z.object({}).catchall(z.string()),
});
export type ObjectivityBiasResponse = z.infer<
  typeof ObjectivityBiasResponseSchema
>;

export const JournalistAnalysisResponseSchema = z.object({
  analysis: z.string(),
});
export type JournalistAnalysisResponse = z.infer<
  typeof JournalistAnalysisResponseSchema
>;

export const PublicationAnalysisResponseSchema = z.object({
  analysis: z.string(),
});
export type PublicationAnalysisResponse = z.infer<
  typeof PublicationAnalysisResponseSchema
>;

export const buildSummaryPrompt = (articleContent: string) => `
Generate a concise and accurate summary of the given news article, highlighting the main points, key arguments, and significant evidence. Use footnotes to cite specific parts of the article, with footnotes containing the exact text from the article for highlighting purposes. Each footnote should be a short and concise piece of text no more than a sentence or two that serves as direct evidence. If the content is not a news article, generate a summary and note that it may not be news content.

**Please present the summary as markdown-formatted bullet points with references to the footnotes using format [^n] for example to reference the nth footnote.**

Article Content:
${articleContent}
`;

export const buildPoliticalBiasPrompt = (articleContent: string) => `
Analyze the given news article for political bias and assign a bias score from 0 to 100 (0 = very left-wing, 50 = moderate, 100 = very right-wing). Provide specific examples from the article that illustrate the bias, using footnotes containing the exact text from the article for highlighting purposes. Each footnote should be a short and concise piece of text no more than a sentence or two that servevs as direct evidence. If the article is not a news article or political bias is not relevant, assign a bias score of 50, explain why in the analysis.

**Please present the analysis as markdown-formatted bullet points with references to the footnotes using format [^n] for example to reference the nth footnote.**

Article Content:
${articleContent}
`;

export const buildObjectivityPrompt = (articleContent: string) => `
Analyze the given news article to determine how opinionated or factual it is, assigning a rhetoric score from 0 to 100 (0 = very opinionated, 100 = very factual). Provide specific examples from the article that illustrate the level of opinionation or factuality, using footnotes containing the exact text from the article for highlighting purposes. Each footnote should be a short and concise piece of text no more than a sentence or two that serves as direct evidence. If the article is not a news article or objectivity analysis is not relevant, assign a rhetoric score of 100, explain why in the analysis.

**Please present the analysis as markdown-formatted bullet points with references to the footnotes using format [^n] for example to reference the nth footnote.**

Article Content:
${articleContent}
`;

export const buildJournalistAnalysisPrompt = (data: JournalistAnalysisData) => `
Given the following data about a journalist's articles, write an analysis explaining the journalist's average polarization and objectivity scores. Include specific examples from the article summaries to support your points.

**Please present the analysis as markdown-formatted bullet points. The analysis should be clear and to the point and no more than a few sentences.**

Data:
- Average Polarization Score: ${
  data.averagePolarization
} (0 = very left-wing, 50 = moderate, 100 = very right-wing)
- Average Objectivity Score: ${
  data.averageObjectivity
} (0 = very opinionated, 100 = very factual)
- Article Summaries: ${JSON.stringify(data.summaries)}
`;

export const buildPublicationAnalysisPrompt = (
  data: PublicationAnalysisData
) => `
Given the following data about a publication's articles, write an analysis explaining the publication's average polarization and objectivity scores. Include specific examples from the article summaries to support your points.

**Please present the analysis as markdown-formatted bullet points. The analysis should be clear and to the point and no more than a few sentences.**

Data:
- Average Polarization Score: ${
  data.averagePolarization
} (0 = very left-wing, 50 = moderate, 100 = very right-wing)
- Average Objectivity Score: ${
  data.averageObjectivity
} (0 = very opinionated, 100 = very factual)
- Article Summaries: ${JSON.stringify(data.summaries)}
`;

export const HTMLParseResponseSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  date_published: z.string(),
  date_updated: z.string(),
  content: z.string(),
});
export type HTMLParseResponse = z.infer<typeof HTMLParseResponseSchema>;

export const buildHtmlParsingPrompt = (htmlDomTree: string) => `
Objective: Parse the given substring of an HTML DOM tree of a news article to extract the following fields: title, author(s), date of publication, date of last update, and the article's main text content. Notice, that this is a substring of an HTML DOM tree, so you should not expect the full HTML structure including closing tags. If text (article content) is the end of the HTML DOM string, that is fine, just make sure to include it in the parsing.

HTML DOM Substring:
${htmlDomTree}

Guidelines for Parsing:

1. **Title**: Identify the title of the article. The title will not be in every chunk, it is normally in the first and will, therefore, be at the beginning of the article, and at the beginning of the DOM tree so most likely in the header tag, and further in the title tag. Many titles will contain the title followed by a line separator (usually | or -) and then the name of the publication. You do not need to include the separator or the publication if it is in this format and not an actual part of the title. If the title cannot be reasonably determined or does not appear to be present, respond with an empty string "".
2. **Author(s)**: Identify the author or authors of the article and respond with their names in format ["author name", "or multiple author names", "or empty array []"]. If the author(s) cannot be reasonably determined, respond with an empty array []. The authors will likely not be in every single chunk, normally it is at the beginning or end of the article. Some author's names will appear to have the publication before it (e.g. CNN's John Doe), in this case, only include the author's name and not the publication.
3. **Date Published**: Extract the date and time the article was published or last updated. This date is often preceded by the word "published" or "updated". If the date cannot be reasonably determined, respond with an empty string "". The date will likely not be in every single chunk, normally it is at the beginning or end of the article. Format the date and time as an ISO 8601 string (e.g., "2024-09-26T14:30:00Z"). If only the date is available without a specific time, use midnight UTC (e.g., "2024-09-26T00:00:00Z"). If the time zone is specified, convert to UTC. If no time zone is specified, assume it's in the local time of the publication and append 'Z' to indicate UTC.
4. **Date Updated**: Extract the date and time the article was last updated, if available. This date is often preceded by words like "updated" or "last modified". Format it the same way as the Date Published. If there's no separate update date or it cannot be determined, respond with an empty string "".
4. **Article Text Content**: Extract the main text content of the article. This content should flow as a normal news article, excluding extraneous elements such as video/image captions, footer lists, copyright info, and other non-article text (e.g., "Breaking News", "Subscribe", etc.). The text should be concatenated as is, without changing punctuation or formatting. If the content cannot be reasonably determined, respond with an empty string ''.

Please parse the HTML DOM substring based on the guidelines and example format provided above.
`;

export const DateUpdatedResponseSchema = z.object({
  date_updated: z.string().nullable(),
});

export type DateUpdatedResponse = z.infer<typeof DateUpdatedResponseSchema>;

export const buildDateUpdatedPrompt = (
  head: string,
  bodySubset: string,
  currentDateUpdated: Date | null
) => `
You are an AI assistant tasked with identifying the "date updated" or "last modified" date of an article.
Given the head and a subset of the body of an HTML document, your task is to find and return the date the article was last updated or modified. This is not the date published, if there is only one date listed without either "updated" or "modified" in the text, that is most likely the date published.

Current known date_updated: ${
  currentDateUpdated ? currentDateUpdated.toISOString() : "None"
}

Head:
${head}

Body subset:
${bodySubset}

Rules:
1. If you find a date updated or last modified date, return it in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ). If the time zone is specified, it should be specified right after the time, convert to UTC. If no time zone is specified, assume it's in eastern daylighttime, convert to UTC, and append 'Z' to indicate UTC.
2. If you don't find any "date updated" or "last modified" date, or if it's the same as the current known date, return null.
3. Only return the date if you're confident it represents when the article was last updated or modified.
`;

export const QuickParseParseResponseSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  date_published: z.string(),
  date_updated: z.string(),
  political_bias_score: z.number(),
  objectivity_score: z.number(),
  summary: z.string(),
});
export type QuickParseResponse = z.infer<typeof QuickParseParseResponseSchema>;

// export const buildQuickParsingPrompt = (head: string, body: string) => `
// Objective: Given the HTML head and HTML body of an HTML news article, extract the following fields: title, author(s), date of publication, date of last update, political bias score, objectivity score, and summary. Notice, that this is all of the text content from an HTML news article, so it will contain ads, videos, and other random extraneous text. The article title should be the first thing in the head tag (or in the first few lines of the body tag, or both), and the article content should be the main text content in the body tag, so any text that does not follow this subject matter or does not read as the normal flow of the article should be ignored. If the content appears to be private or sensitive information, please do not include this text. These summaries are shared across users, so only analysis on public information (preferably news articles) should be allowed.

// HTML Head:
// ${head}

// HTML Body:
// ${body}

// Guidelines for Parsing:

// 1. **Title**: Identify the title of the article. The title will most likely be in the head or at the beginning of the body. Many titles will contain the title followed by a line separator (usually | or -) and then the name of the publication. You do not need to include the separator or the publication if it is in this format and not an actual part of the title. If the title cannot be reasonably determined or does not appear to be present, generate a title based on the content.
// 2. **Author(s)**: Identify the author or authors of the article and respond with their names in format ["author name", "or multiple author names", "or empty array []"]. If the author(s) cannot be reasonably determined, respond with an empty array []. The authors will not always be listed, normally it is at the beginning or end of the article. Some author's names will appear to have the publication before it (e.g. CNN's John Doe), in this case, only include the author's name and not the publication. The authors names should read like normal human names, or if it is the staff, e.g. CNN Staff, that is okay too.
// 3. **Date Published**: Extract the date and time the article was published or last updated. This date is often preceded by the word "published" or "updated". If the date cannot be reasonably determined, respond with an empty string "". The date is normally at the beginning or end of the article. Format the date and time as an ISO 8601 string (e.g., "2024-09-26T14:30:00Z"). If only the date is available without a specific time, use midnight UTC (e.g., "2024-09-26T00:00:00Z"). If the time zone is specified, convert to UTC. If no time zone is specified, it should be specified right after the time, assume it's in eastern daylight time, convert to UTC, and append 'Z' to indicate UTC.
// 4. **Date Updated**: Extract the date and time the article was last updated, if available. This date is often preceded by words like "updated" or "last modified". Format it the same way as the Date Published. If there's no separate update date or it cannot be determined, respond with an empty string "".
// 5. **Political Bias Score**: Analyze the given news article for political bias and assign a bias score from 0 to 100 (0 = very left-wing/democrat/liberal, 50 = moderate, 100 = very right-wing/republican/conservative). If the article is not a news article or political bias is not relevant, assign a bias score of 50.
// 6. **Objectivity Score**: Analyze the given news article to determine how opinionated or factual it is, assigning a rhetoric score from 0 to 100 (0 = very opinionated, 100 = very factual).If the article is not a news article or objectivity analysis is not relevant, assign a rhetoric score of 100.
// 7. **Article Summary**: Generate a concise and accurate summary of the given news article, highlighting the main points, key arguments, significant evidence, political bias, and objectivity. Generate multiple bullet points for the summary (depending on how long the article is) that give a complete summary of the article, one bullet for political bias explaining the score and rationale as to why it received that score including direct evidence from the article and one for objectivity score explaining the same thing. The goal of this summary is to provide a quick overview of the article's content (it should be clear and concise but also sufficient to get the gist of the article), political bias, and objectivity, so at a glance a user can understand what they are looking at without spending any time reading the actual article. If the content is not a news article, generate a summary and note that it may not be news content. If the content appears to be private or sensitive information, please do not include this text. These summaries are shared across users, so only analysis on public information (preferably news articles) should be allowed.

// Please parse the HTML DOM substring based on the guidelines and example format provided above.
// `;
export const buildQuickParsingPrompt = (head: string, body: string) => `
Objective: Given the HTML head and HTML body of an HTML news article, extract the following fields: title, author(s), date of publication, date of last update, political bias score, objectivity score, and summary. Notice, that this is all of the text content from an HTML news article, so it will contain ads, videos, and other random extraneous text. The article title should be the first thing in the head tag (or in the first few lines of the body tag, or both), and the article content should be the main text content in the body tag, so any text that does not follow this subject matter or does not read as the normal flow of the article should be ignored. If the content appears to be private or sensitive information, please do not include this text. These summaries are shared across users, so only analysis on public information (preferably news articles) should be allowed.

HTML Head:
${head}

HTML Body:
${body}

Guidelines for Parsing:

1. **Title**: Identify the title of the article. The title will most likely be in the head or at the beginning of the body. Many titles will contain the title followed by a line separator (usually | or -) and then the name of the publication. You do not need to include the separator or the publication if it is in this format and not an actual part of the title. If the title cannot be reasonably determined or does not appear to be present, generate a title based on the content.

2. **Author(s)**: Identify the author or authors of the article and respond with their names in format ["author name", "or multiple author names", "or empty array []"]. If the author(s) cannot be reasonably determined, respond with an empty array []. The authors will not always be listed, normally it is at the beginning or end of the article. Some author's names will appear to have the publication before it (e.g. CNN's John Doe), in this case, only include the author's name and not the publication. The authors names should read like normal human names, or if it is the staff, e.g. CNN Staff, that is okay too.

3. **Date Published**: Extract the date and time the article was published or last updated. This date is often preceded by the word "published" or "updated". If the date cannot be reasonably determined, respond with an empty string "". The date is normally at the beginning or end of the article. Format the date and time as an ISO 8601 string (e.g., "2024-09-26T14:30:00Z"). If only the date is available without a specific time, use midnight UTC (e.g., "2024-09-26T00:00:00Z"). If the time zone is specified, convert to UTC. If no time zone is specified, it should be specified right after the time, assume it's in eastern daylight time, convert to UTC, and append 'Z' to indicate UTC.

4. **Date Updated**: Extract the date and time the article was last updated, if available. This date is often preceded by words like "updated" or "last modified". Format it the same way as the Date Published. If there's no separate update date or it cannot be determined, respond with an empty string "".

5. **Political Bias Score**: Analyze the article for political bias and assign a score from 0 to 100, where:
   - 0-20: Strongly left-leaning (progressive/liberal)
   - 21-40: Moderately left-leaning
   - 41-60: Centrist/balanced
   - 61-80: Moderately right-leaning
   - 81-100: Strongly right-leaning (conservative/traditional)
   
   Consider these factors equally when determining bias:
   - Topic selection and emphasis
   - Word choice and framing
   - Sources quoted and their political alignment
   - Context provided or omitted
   - Representation of different viewpoints
   - Historical and factual accuracy
   
   Evaluate each factor independently and avoid letting one factor dominate your assessment. Be particularly careful to differentiate between factual reporting that may appear critical of either side versus actual political bias. If the article is not political in nature, assign a score of 50.

6. **Objectivity Score**: Analyze the article's objectivity and assign a score from 0 to 100, where:
   - 0-20: Highly opinionated (primarily opinion with few facts)
   - 21-40: More opinion than fact
   - 41-60: Balanced mix of fact and opinion
   - 61-80: More fact than opinion
   - 81-100: Highly factual (primarily straightforward reporting)
   
   Base this evaluation on:
   - Ratio of verifiable facts to opinions/commentary
   - Use of loaded language or emotional appeals
   - Presence of multiple perspectives
   - Attribution of claims to specific sources
   - Clear distinction between news and commentary
   
   If the article is not a news article, assign a score of 50.

7. **Article Summary**: Generate a concise and accurate summary of the article, including:
   - 3-5 bullet points covering the main factual points
   - 1 bullet point explaining the political bias score with specific examples from the text
   - 1 bullet point explaining the objectivity score with specific examples from the text
   
   The summary should be clear and comprehensive enough that a reader can understand the article's key points without reading the full text. Focus on accurately representing the article's content regardless of your own political views. If the content appears to be private or sensitive information, do not include this text.

Please parse the HTML DOM substring based on the guidelines provided above. Be careful to analyze bias based on concrete textual evidence rather than assumptions, and consider multiple interpretations when evaluating political leanings.
`;

export type ArticleData = {
  title: string;
  date_published: Date;
  date_updated?: Date;
  authors: string[];
  text: string;
  url: string;
  hostname: string;
};

export const PublicationMetadataSchema = z.object({
  name: z.string().nullable(),
  date_founded: z.string().nullable(),
});

export type PublicationMetadataResponse = z.infer<
  typeof PublicationMetadataSchema
>;

export const buildPublicationMetadataPrompt = (hostname: string) => `
Given the hostname of a website (e.g., www.cnn.com), return the human-friendly name of the company who owns the website (or what the company is commonly referred as) and the date it was founded in format MM/DD/YYYY. For many hostnames you should be able to infer the company, but not always, for example, for "www.cnn.com" the correct response would be "CNN".

If you do not have knowledge on the name of the company, simply respond with the url but remove www. (e.g. www.peoplespress.com would be peoplespress.com) for the name field. If the date the company was founded is not in your knowledge, please respond with an empty string '' for the date_founded field.

The accuracy of this information is important.

Please provide the metadata for the following hostname:

${hostname}
`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Simplify the schema to just include the response
export const ChatResponseSchema = z.object({
  response: z.string(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const buildChatPrompt = (
  userMessage: string,
  context: {
    articleText: string;
    articleSummary?: string;
    politicalBiasScore?: number;
    politicalBiasAnalysis?: string;
    objectivityScore?: number;
    objectivityAnalysis?: string;
    journalistAnalyses?: Array<{
      name: string;
      analysis: string;
      bias_score: number;
      rhetoric_score: number;
    }>;
    publicationAnalysis?: {
      name: string;
      analysis: string;
      bias_score: number;
      rhetoric_score: number;
    };
  },
  previousMessages: ChatMessage[] = []
) => `
You are a friendly and helpful AI assistant helping users understand news articles. Think of yourself as a knowledgeable friend who makes complex topics easy to understand. Keep responses concise and engaging unless specifically asked for more detail.

CONTEXT:
Article Text:
${context.articleText}

Article Summary: ${context.articleSummary || "Not available"}

Political Bias Score: ${context.politicalBiasScore || "Not available"}
(Scale: 0=left-wing, 50=neutral, 100=right-wing)
Political Bias Analysis: ${context.politicalBiasAnalysis || "Not available"}

Objectivity Score: ${context.objectivityScore || "Not available"}
(Scale: 0=opinionated, 100=factual)
Objectivity Analysis: ${context.objectivityAnalysis || "Not available"}

${
  context.journalistAnalyses && context.journalistAnalyses.length > 0
    ? `Journalist Analyses:
${context.journalistAnalyses
  .map(
    (j) => `- ${j.name}:
  Analysis: ${j.analysis}
  Bias Score: ${j.bias_score} (0=left, 50=center, 100=right)
  Rhetoric Score: ${j.rhetoric_score} (0=opinionated, 100=factual)`
  )
  .join("\n")}`
    : "Journalist Analyses: Not available"
}

${
  context.publicationAnalysis
    ? `Publication Analysis:
Name: ${context.publicationAnalysis.name}
Analysis: ${context.publicationAnalysis.analysis}
Bias Score: ${context.publicationAnalysis.bias_score} (0=left, 50=center, 100=right)
Rhetoric Score: ${context.publicationAnalysis.rhetoric_score} (0=opinionated, 100=factual)`
    : "Publication Analysis: Not available"
}

PREVIOUS CONVERSATION:
${previousMessages
  .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
  .join("\n")}

CURRENT QUESTION:
${userMessage}

RESPONSE GUIDELINES:
1. Be concise and direct - users prefer short, clear answers they can quickly understand
2. Use a friendly, conversational tone
3. Only provide detailed explanations if specifically requested
4. When mentioning bias or objectivity scores, use simple terms (left/right, factual/opinionated)
5. If asked about something outside the article, briefly acknowledge this
6. Use markdown for emphasis only when it adds clarity
7. Make complex topics accessible and interesting

Remember: You're having a casual conversation with someone interested in understanding the news better. Keep it light and engaging while being informative.`;
