// import * as cheerio from "cheerio";
// https://github.com/cheeriojs/cheerio/issues/1407
const cheerio = require("cheerio");
import { getHostname, parseDateString } from "./helpers";
import { ArticleData } from "../types";
import {
  HTMLParseResponse,
  buildHtmlParsingPrompt,
  isHTMLParseResponse,
} from "../prompts/prompts";
import { buildRequestPayload, gptApiCall } from "../prompts/chatgpt";
import { BaseParser } from "./BaseParser";
import { AxiosResponse } from "axios";

/** Smart parser using LLMs to parser article */
export class SmartParser extends BaseParser {
  /**
   * Get the HTML content of the entire DOM
   * @returns The HTML content of the entire DOM
   */
  getHTML(): string {
    return this.$.html();
  }

  cleanContent(): void {
    const $ = this.$;
    // Remove all attributes from all elements
    $("*").each(function (idx, elem) {
      const attributes = $(elem).attr();
      for (let attr in attributes) {
        $(elem).removeAttr(attr);
      }
    });
  }

  async smartParse(): Promise<HTMLParseResponse | null> {
    this.cleanContent();

    const chunks = super.chunkHTML();

    console.info("Chunks:", chunks);

    const chunkPromises: Promise<AxiosResponse<any>>[] = [];
    chunks.forEach((chunk) => {
      const prompt = buildHtmlParsingPrompt(chunk);
      const requestPayload = buildRequestPayload(prompt);
      console.info("Request payload:", requestPayload);
      const promise = gptApiCall(requestPayload);
      chunkPromises.push(promise);
    });

    // Wait for all promises to resolve
    const responses = await Promise.all(chunkPromises);

    let title = "";
    const authorSet = new Set<string>();
    let articleContent = "";
    let datePublished = "";

    responses.forEach((response, idx) => {
      const data = response.data.choices[0].message.content;
      console.info("Raw API response:", data);

      // Attempt to parse the JSON response
      let jsonResponse: any;
      try {
        jsonResponse = JSON.parse(data);
      } catch (parseError) {
        console.error(
          `Error parsing JSON response for chunk ${idx}:`,
          parseError
        );
        return;
      }
      // Validate the JSON structure
      if (isHTMLParseResponse(jsonResponse)) {
        console.info("HTML Parse Response:", jsonResponse);
        if (!title) {
          console.info("Setting title:", jsonResponse.title);
          title = jsonResponse.title;
        }
        jsonResponse.authors.forEach((author: string) => {
          console.info("Adding author:", author);
          authorSet.add(author);
        });
        if (!datePublished) {
          console.info("Setting date published:", jsonResponse.date_published);
          datePublished = jsonResponse.date_published;
        }
        console.info("Adding content:", jsonResponse.content);
        articleContent += jsonResponse.content;
      } else {
        console.error("Invalid HTML parse JSON structure:", jsonResponse);
      }
    });

    return {
      title,
      authors: Array.from(authorSet),
      date_published: datePublished,
      content: articleContent,
    };
  }

  /**
   * Parse the article and return the data
   * @returns The parsed article data
   */
  async parse(): Promise<ArticleData> {
    // Run smart parsing
    const smartParseResponse = await this.smartParse();
    if (!smartParseResponse) {
      console.error("Error running smart parse, cannot parse article");
      return {
        title: "",
        authors: [],
        date: new Date(),
        hostname: getHostname(this.url),
        url: this.url,
        text: "",
      };
    }

    const { title, authors, date_published, content } = smartParseResponse;
    // Convert date string to Date object
    const datePublishedObject = parseDateString(date_published);
    if (!datePublishedObject) {
      console.error("Error parsing date string:", date_published);
    }

    console.info("Smart Parse Response:", smartParseResponse);

    // Get properties before we clean
    const hostname = getHostname(this.url);
    const cleanedContent = this.postProcessContent(content);

    return {
      title,
      authors,
      date: datePublishedObject ?? new Date(),
      hostname,
      url: this.url,
      text: cleanedContent,
    };
  }
}
