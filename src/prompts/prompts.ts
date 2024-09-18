import { JournalistAnalysisData, PublicationAnalysisData } from "./chatgpt";

export const articleContentReplace = "[Insert article content here]";

// This should ALWAYS match the output example in the summary prompt
export type SummaryResponseType = {
  summary: string;
  footnotes: { [key: string]: string };
};

export const isSummaryResponse = (json: any): json is SummaryResponseType => {
  return (
    typeof json === "object" &&
    json !== null &&
    typeof json.summary === "string" &&
    typeof json.footnotes === "object" &&
    json.footnotes !== null &&
    Object.keys(json.footnotes).every(
      (key) => typeof json.footnotes[key] === "string"
    )
  );
};

export const summaryPrompt = `
Objective: Generate a concise and accurate summary of the given news article. The summary should highlight the main points, key arguments, and significant evidence presented in the article. Ensure that the summary is factual and provides direct evidence by citing specific parts of the article using footnotes. If the content does not appear to be a news article, that is okay, generate a summary anyways and consider commenting that this does not appear to be news content. The output should be in JSON format.

Article Content:
${articleContentReplace}

Guidelines for Summary:

1. Main Points: Identify and summarize the main points and key arguments presented in the article.
2. Key Evidence: Integrate significant evidence and examples directly within the main points using footnotes for references.
3. Neutral Tone: Maintain a neutral tone, avoiding any bias or subjective language.
4. Conciseness: Keep the summary concise, ideally between 100-150 words.
5. Footnotes: Use footnotes to provide direct references or quotes from the article.
6. JSON Format: Ensure the output is in the following JSON format:
   - Do not include any Markdown formatting or code blocks in the output.
{
  "summary": "The article discusses the impact of climate change on coastal cities, noting that rising sea levels are leading to increased flooding[^1]. It examines the economic implications, highlighting the cost of infrastructure damage[^2]. Additionally, it addresses the challenges faced by local governments in mitigating these effects[^3].",
  "footnotes": {
    "^1": "In the past decade, sea levels have risen by an average of 3.3 millimeters per year, causing more frequent and severe coastal flooding.",
    "^2": "The damage to infrastructure is expected to cost billions of dollars annually by 2050.",
    "^3": "Local governments are struggling to implement effective measures due to budget constraints and political challenges."
  }
}

Summary:

Please generate a summary based on the guidelines and example format provided above.
`;

// This should ALWAYS match the output example in the political bias prompt
export type PoliticalBiasResponseType = {
  bias_score: number;
  analysis: string;
  footnotes: { [key: string]: string };
};

export const isPoliticalBiasResponse = (
  json: any
): json is PoliticalBiasResponseType => {
  return (
    typeof json === "object" &&
    json !== null &&
    (typeof json.bias_score === "number" ||
      typeof json.bias_score === "string") &&
    typeof json.analysis === "string" &&
    typeof json.footnotes === "object" &&
    json.footnotes !== null &&
    Object.keys(json.footnotes).every(
      (key) => typeof json.footnotes[key] === "string"
    )
  );
};

export const politicalBiasPrompt = `
Objective: Analyze the given news article for political bias and generate a bias score from 0 to 100 where 0 is very left wing, 50 is moderate, and 100 is very right wing. Provide specific examples from the article that illustrate the bias, using footnotes for references. If the article does not appear to be a news article or a political bias score is not relevant for the content, reply with 50 for the bias_score, provide a reason why in the analysis section, and respond with an empty object {} for footnotes. The output should be in JSON format.

Article Content:
${articleContentReplace}

Guidelines for Analysis:

1. Bias Score: Assign a bias score from 0 to 100 where 0 is very left wing, 50 is moderate, and 100 is very right wing.
2. Main Indicators: Identify main indicators of bias in the article, such as language, framing, selection of facts, and sources.
3. Key Evidence: Integrate significant evidence and examples directly within the analysis using footnotes for references.
4. Neutral Tone: Maintain a neutral tone, avoiding any bias or subjective language.
5. JSON Format: Ensure the output is in the following JSON format:
   - Do not include any Markdown formatting or code blocks in the output.

{
  "bias_score": 0,
  "analysis": "The article predominantly uses language and framing that support left-wing perspectives. For example, it describes progressive policies positively while criticizing conservative viewpoints[^1]. The selection of facts and sources also shows a preference for left-leaning information[^2].",
  "footnotes": {
    "^1": "The article states, 'Progressive policies are essential for social justice and equity.'",
    "^2": "It cites studies from predominantly left-leaning think tanks while ignoring conservative perspectives."
  }
}

Analysis:

Please analyze the political biases in the article based on the guidelines and example format provided above.
`;

// This should ALWAYS match the output example in the objectivity prompt
export type ObjectivityBiasResponseType = {
  rhetoric_score: number;
  analysis: string;
  footnotes: { [key: string]: string };
};

export const isObjectivityResponse = (
  json: any
): json is ObjectivityBiasResponseType => {
  return (
    typeof json === "object" &&
    json !== null &&
    (typeof json.rhetoric_score === "number" ||
      typeof json.rhetoric_score === "string") &&
    typeof json.analysis === "string" &&
    typeof json.footnotes === "object" &&
    json.footnotes !== null &&
    Object.keys(json.footnotes).every(
      (key) => typeof json.footnotes[key] === "string"
    )
  );
};

export const objectivityPrompt = `
Objective: Analyze the given news article to determine how opinionated/persuasive it is versus how factual/objective it is. Generate a score from 0 to 100 where 0 is very opinionated/rhetorical (think op-ed piece) and 100 is very factual/objective (think only the facts). Provide specific examples from the article that illustrate the level of opinionation or factuality, using footnotes for references. If the article does not appear to be a news article or a objectivity score is not relevant for the content, reply with either 0 or 100 for the rhetoric_score, provide a reason why in the analysis section, and respond with an empty object {} for footnotes. The output should be in JSON format.

Article Content:
${articleContentReplace}

Guidelines for Analysis:

1. Rhetoric Score: Assign a rhetoric score from 0 to 100 where 0 is very opinionated/rhetorical and 100 is very factual/objective.
2. Main Indicators: Identify main indicators of rhetoric in the article, such as language, tone, use of evidence, and presentation of facts versus opinions.
3. Key Evidence: Integrate significant evidence and examples directly within the analysis using footnotes for references.
4. Neutral Tone: Maintain a neutral tone, avoiding any bias or subjective language.
5. JSON Format: Ensure the output is in the following JSON format:
   - Do not include any Markdown formatting or code blocks in the output.

{
  "rhetoric_score": 0,
  "analysis": "The article predominantly uses opinionated language and persuasive arguments. For example, it makes assertive statements without substantial evidence[^1]. The tone is subjective, emphasizing personal viewpoints over factual reporting[^2].",
  "footnotes": {
    "^1": "The article states, 'The government's approach is flawed and destined to fail.'",
    "^2": "It uses phrases like 'I believe' and 'It seems clear that,' which indicate a subjective perspective."
  }
}

Analysis:

Please analyze the rhetoric in the article based on the guidelines and example format provided above.
`;

type PublicationMetadataResponse = {
  name: string | null;
  date_founded: string | null;
};

export const isPublicationMetadataResponse = (
  json: any
): json is PublicationMetadataResponse => {
  return (
    typeof json === "object" &&
    json !== null &&
    typeof json.name === "string" &&
    typeof json.date_founded === "string"
  );
};

export const publicationMetadataPrompt = `
Given the hostname of a news company (e.g., www.cnn.com), return a JSON object containing metadata information on the news company. Do not include any Markdown formattign or code blocks in the output. The structure of the JSON object should be as follows:

{
  name: string, // human-friendly name (or what news company is commonly referred as)
  date_founded: string // in format MM/DD/YYYY
}

For example, for "www.cnn.com" the correct response would be:

{
  name: "CNN",
  date_founded: "06/01/1980"
}

If there is confusion or you cannot retrieve the proper human-readable name, please respond with the url but remove www. (e.g. www.github.com would be github.com) for the name field. If the date the news company was founded is not in your knowledge or is confusing/could have multiple interpretations, please also respond with "NULL" for the date_founded field.

The accuracy of this information is important.

Please provide the JSON response for the following hostname:

{hostname}
`;

export type JournalistAnalysisResponse = {
  analysis: string;
};

export const isJournalistAnalysisResponse = (
  json: any
): json is JournalistAnalysisResponse => {
  return (
    typeof json === "object" &&
    json !== null &&
    typeof json.analysis === "string"
  );
};

export const buildJournalistAnalysisPrompt = (data: JournalistAnalysisData) => {
  return `
Given the following data about a journalist's articles, write a singular cohesive analysis on why the journalist is receiving their polarization and objectivity scores:

{
    averagePolarization: number; // Score from 0 to 100 on how polarized the journalist was in the articles they have written. 0 is very left wing and 100 is very right wing, 50 is moderate.
    averageObjectivity: number;  // Score from 0 to 100 on how objective a journalist was in the articles they have written. 0 means completely subjective (op-eds), 100 means objective.
    summaries: string[]; // Summaries of all articles journalist has written
}

In your analysis, include the following points:
1. Explain the average polarization score and what it indicates about the journalist's writing.
2. Explain the average objectivity score and what it indicates about the journalist's writing.
3. Provide specific examples from the article summaries to support your analysis.

Please return the analysis in the following JSON format without including any Markdown formatting or backticks, and ensure all newline characters within strings are properly escaped:

{
  "analysis": "string"
}

Please provide the analysis for the following data:

{
    "averagePolarization": ${data.averagePolarization},
    "averageObjectivity": ${data.averageObjectivity},
    "summaries": ${JSON.stringify(data.summaries)}
}
`;
};

export const buildPublicationAnalysisPrompt = (
  data: PublicationAnalysisData
) => {
  return `
Given the following data about a publication's articles, write a singular cohesive analysis on why the publication is receiving their polarization and objectivity scores:

{
    averagePolarization: number; // Score from 0 to 1 on how polarized the publication was in the articles they have published. 0 is very left wing and 1 is very right wing, 0.5 is moderate.
    averageObjectivity: number;  // Score from 0 to 1 on how objective the publication was in the articles they have published. 0 means completely subjective (op-eds), 1 means objective.
    summaries: string[]; // Summaries of all articles the publication has published
}

In your analysis, include the following points:
1. Explain the average polarization score and what it indicates about the publication's articles.
2. Explain the average objectivity score and what it indicates about the publication's articles.
3. Provide specific examples from the article summaries to support your analysis.

Please return the analysis in the following JSON format without including any Markdown formatting or backticks, and ensure all newline characters within strings are properly escaped:

{
  "analysis": "string"
}

Please provide the analysis for the following data:

{
    "averagePolarization": ${data.averagePolarization},
    "averageObjectivity": ${data.averageObjectivity},
    "summaries": ${JSON.stringify(data.summaries)}
}
`;
};

export type HTMLParseResponse = {
  title: string;
  authors: string[];
  date_published: string;
  content: string;
};

export const isHTMLParseResponse = (json: any): json is HTMLParseResponse => {
  return (
    typeof json === "object" &&
    json !== null &&
    typeof json.title === "string" &&
    Array.isArray(json.authors) &&
    json.authors.every((author: string) => typeof author === "string") &&
    typeof json.date_published === "string" &&
    typeof json.content === "string"
  );
};

export const buildHtmlParsingPrompt = (htmlDomTree: string) => `
Objective: Parse the given substring of an HTML DOM tree of a news article to extract the following fields: title, author(s), date of publication (or last updated date), and the article's main text content. The output should be in JSON format. Notice, that this is a substring of an HTML DOM tree, so you should not expect the full HTML structure including closing tags. If text (article content) is the end of the HTML DOM string, that is fine, just make sure to include it in the parsing.

HTML DOM Substring:
${htmlDomTree}

Guidelines for Parsing:

1. **Title**: Identify the title of the article. The title will not be in every chunk, it is normally in the first and will, therefore, be at the beginning of the article, and at the beginning of the DOM tree so most likely in the header tag, and further in the title tag. Many titles will contain the title followed by a line separator (usually | or -) and then the name of the publication. You do not need to include the separator or the publication if it is in this format and not an actual part of the title. If the title cannot be reasonably determined or does not appear ot be present, respond with an empty string "".
2. **Author(s)**: Identify the author or authors of the article. If the author(s) cannot be reasonably determined, respond with an empty array []. The authors will likely not be in every single chunk, normally it is at the beginning or end of the article.
3. **Date Published**: Extract the date the article was published or last updated. This date is often preceded by the word "published" or "updated". If the date cannot be reasonably determined, respond with an empty string "". The date will likely not be in every single chunk, normally it is at the beginning or end of the article. The date should be in the format "MM/DD/YYYY".
4. **Article Text Content**: Extract the main text content of the article. This content should flow as a normal news article, excluding extraneous elements such as video/image captions, footer lists, copyright info, and other non-article text (e.g., "Breaking News", "Subscribe", etc.). The text should be concatenated as is, without changing punctuation or formatting. If the content cannot be reasonably determined, respond with an empty string "".

Please return the output in the following JSON format without including any Markdown formatting or backticks, and ensure all newline characters within strings are properly escaped:

{
  "title": "string or """,
  "authors": ["author name or multiple author names or []"],
  "date_published": "MM/DD/YYYY or """,
  "content": "string of the article content or """
}

Parsing:

Please parse the HTML DOM substring based on the guidelines and example format provided above.
`;
