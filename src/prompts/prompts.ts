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
Objective: Generate a concise and accurate summary of the given news article. The summary should highlight the main points, key arguments, and significant evidence presented in the article. Ensure that the summary is factual and provides direct evidence by citing specific parts of the article using footnotes. The output should be in JSON format.

Article Content:
${articleContentReplace}

Guidelines for Summary:

1. Main Points: Identify and summarize the main points and key arguments presented in the article.
2. Key Evidence: Integrate significant evidence and examples directly within the main points using footnotes for references.
3. Neutral Tone: Maintain a neutral tone, avoiding any bias or subjective language.
4. Conciseness: Keep the summary concise, ideally between 100-150 words.
5. Footnotes: Use footnotes to provide direct references or quotes from the article.
6. JSON Format: Ensure the output is in the following JSON format:

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
    typeof json.bias_score === "number" &&
    typeof json.analysis === "string" &&
    typeof json.footnotes === "object" &&
    json.footnotes !== null &&
    Object.keys(json.footnotes).every(
      (key) => typeof json.footnotes[key] === "string"
    )
  );
};

export const politicalBiasPrompt = `
Objective: Analyze the given news article for political bias and generate a bias score from 0 to 100 where 0 is very left wing, 50 is moderate, and 100 is very right wing. Provide specific examples from the article that illustrate the bias, using footnotes for references. The output should be in JSON format.

Article Content:
${articleContentReplace}

Guidelines for Analysis:

1. Bias Score: Assign a bias score from 0 to 100 where 0 is very left wing, 50 is moderate, and 100 is very right wing.
2. Main Indicators: Identify main indicators of bias in the article, such as language, framing, selection of facts, and sources.
3. Key Evidence: Integrate significant evidence and examples directly within the analysis using footnotes for references.
4. Neutral Tone: Maintain a neutral tone, avoiding any bias or subjective language.
5. JSON Format: Ensure the output is in the following JSON format:

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
    typeof json.rhetoric_score === "number" &&
    typeof json.analysis === "string" &&
    typeof json.footnotes === "object" &&
    json.footnotes !== null &&
    Object.keys(json.footnotes).every(
      (key) => typeof json.footnotes[key] === "string"
    )
  );
};

export const objectivityPrompt = `
Objective: Analyze the given news article to determine how opinionated/persuasive it is versus how factual/objective it is. Generate a score from 0 to 100 where 0 is very opinionated/rhetorical (think op-ed piece) and 100 is very factual/objective (think only the facts). Provide specific examples from the article that illustrate the level of opinionation or factuality, using footnotes for references. The output should be in JSON format.

Article Content:
${articleContentReplace}

Guidelines for Analysis:

1. Rhetoric Score: Assign a rhetoric score from 0 to 100 where 0 is very opinionated/rhetorical and 100 is very factual/objective.
2. Main Indicators: Identify main indicators of rhetoric in the article, such as language, tone, use of evidence, and presentation of facts versus opinions.
3. Key Evidence: Integrate significant evidence and examples directly within the analysis using footnotes for references.
4. Neutral Tone: Maintain a neutral tone, avoiding any bias or subjective language.
5. JSON Format: Ensure the output is in the following JSON format:

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
