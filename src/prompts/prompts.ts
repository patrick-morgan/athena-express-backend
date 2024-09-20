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
Generate a concise and accurate summary of the given news article, highlighting the main points, key arguments, and significant evidence. Use footnotes to cite specific parts of the article, with footnotes containing the exact text from the article for highlighting purposes. If the content is not a news article, generate a summary and note that it may not be news content.

**Please present the summary as markdown-formatted bullet points in the 'summary' field of the JSON output.**

Article Content:
${articleContent}
`;

export const buildPoliticalBiasPrompt = (articleContent: string) => `
Analyze the given news article for political bias and assign a bias score from 0 to 100 (0 = very left-wing, 50 = moderate, 100 = very right-wing). Provide specific examples from the article that illustrate the bias, using footnotes containing the exact text from the article for highlighting purposes. If the article is not a news article or political bias is not relevant, assign a bias score of 50, explain why in the analysis, and provide an empty object for footnotes.

**Please present the analysis as markdown-formatted bullet points in the 'analysis' field of the JSON output.**

Article Content:
${articleContent}
`;

export const buildObjectivityPrompt = (articleContent: string) => `
Analyze the given news article to determine how opinionated or factual it is, assigning a rhetoric score from 0 to 100 (0 = very opinionated, 100 = very factual). Provide specific examples from the article that illustrate the level of opinionation or factuality, using footnotes containing the exact text from the article for highlighting purposes. If the article is not a news article or objectivity analysis is not relevant, assign a rhetoric score of 100, explain why in the analysis, and provide an empty object for footnotes.

**Please present the analysis as markdown-formatted bullet points in the 'analysis' field of the JSON output.**

Article Content:
${articleContent}
`;

export const buildJournalistAnalysisPrompt = (data: JournalistAnalysisData) => `
Given the following data about a journalist's articles, write an analysis explaining the journalist's average polarization and objectivity scores. Include specific examples from the article summaries to support your points.

**Please present the analysis as markdown-formatted bullet points in the 'analysis' field of the JSON output.**

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

**Please present the analysis as markdown-formatted bullet points in the 'analysis' field of the JSON output.**

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
  content: z.string(),
});
export type HTMLParseResponse = z.infer<typeof HTMLParseResponseSchema>;

export const buildHtmlParsingPrompt = (htmlDomTree: string) => `
Objective: Parse the given substring of an HTML DOM tree of a news article to extract the following fields: title, author(s), date of publication (or last updated date), and the article's main text content. The output should be in JSON format. Notice, that this is a substring of an HTML DOM tree, so you should not expect the full HTML structure including closing tags. If text (article content) is the end of the HTML DOM string, that is fine, just make sure to include it in the parsing.

HTML DOM Substring:
${htmlDomTree}

Guidelines for Parsing:

1. **Title**: Identify the title of the article. The title will not be in every chunk, it is normally in the first and will, therefore, be at the beginning of the article, and at the beginning of the DOM tree so most likely in the header tag, and further in the title tag. Many titles will contain the title followed by a line separator (usually | or -) and then the name of the publication. You do not need to include the separator or the publication if it is in this format and not an actual part of the title. If the title cannot be reasonably determined or does not appear to be present, respond with an empty string "".
2. **Author(s)**: Identify the author or authors of the article. If the author(s) cannot be reasonably determined, respond with an empty array []. The authors will likely not be in every single chunk, normally it is at the beginning or end of the article.
3. **Date Published**: Extract the date the article was published or last updated. This date is often preceded by the word "published" or "updated". If the date cannot be reasonably determined, respond with an empty string "". The date will likely not be in every single chunk, normally it is at the beginning or end of the article. The date should be in the format "MM/DD/YYYY".
4. **Article Text Content**: Extract the main text content of the article. This content should flow as a normal news article, excluding extraneous elements such as video/image captions, footer lists, copyright info, and other non-article text (e.g., "Breaking News", "Subscribe", etc.). The text should be concatenated as is, without changing punctuation or formatting. If the content cannot be reasonably determined, respond with an empty string "".

Return your response in the following JSON format:

{
  "title": "string or ''",
  "authors": ["author name", "or multiple author names", "or empty array []"],
  "date_published": "MM/DD/YYYY or ''",
  "content": "string of the article content or ''"
}

Parsing:

Please parse the HTML DOM substring based on the guidelines and example format provided above.
`;

export type ArticleData = {
  title: string;
  date: Date;
  authors: string[];
  text: string;
  url: string;
  hostname: string;
  subtitle?: string;
};

export const PublicationMetadataSchema = z.object({
  name: z.string().nullable(),
  date_founded: z.string().nullable(),
});

export type PublicationMetadataResponse = z.infer<
  typeof PublicationMetadataSchema
>;

export const publicationMetadataPrompt = `
Given the hostname of a news company (e.g., www.cnn.com), return a JSON object containing metadata information on the news company. The structure of the JSON object should be as follows:

{
  "name": string, // human-friendly name (or what news company is commonly referred as)
  "date_founded": string // in format MM/DD/YYYY
}

For example, for "www.cnn.com" the correct response would be:

{
  "name": "CNN",
  "date_founded": "06/01/1980"
}

If there is confusion or you cannot retrieve the proper human-readable name, please respond with the url but remove www. (e.g. www.github.com would be github.com) for the name field. If the date the news company was founded is not in your knowledge or is confusing/could have multiple interpretations, please respond with null for the date_founded field.

The accuracy of this information is important.

Please provide the JSON response for the following hostname:

{hostname}
`;
