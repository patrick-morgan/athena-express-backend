// import * as cheerio from "cheerio";
// https://github.com/cheeriojs/cheerio/issues/1407
// const cheerio = require("cheerio");
import { getHostname, parseDateString } from "./helpers";
import { ArticleData } from "../types";
import {
  HTMLParseResponse,
  HTMLParseResponseSchema,
  buildHtmlParsingPrompt,
} from "../prompts/prompts";
import { gptApiCall } from "../prompts/chatgpt";
import { BaseParser } from "./BaseParser";
import { ParsedChatCompletion } from "openai/resources/beta/chat/completions";

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

    const chunkPromises: Promise<ParsedChatCompletion<any>>[] = [];
    chunks.forEach((chunk) => {
      const prompt = buildHtmlParsingPrompt(chunk);
      const requestPayload = {
        prompt,
        zodSchema: HTMLParseResponseSchema,
        propertyName: "html_parse",
      };
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
    let dateUpdated = "";

    responses.forEach((response, idx) => {
      const data: HTMLParseResponse = response.choices[0].message.parsed;
      console.info("HTML parse response:", data);

      if (!title) {
        console.info("Setting title:", data.title);
        title = data.title;
      }
      data.authors.forEach((author: string) => {
        console.info("Adding author:", author);
        authorSet.add(author);
      });
      if (!datePublished) {
        console.info("Setting date published:", data.date_published);
        datePublished = data.date_published;
      }
      if (!dateUpdated) {
        console.info("Setting date updated:", data.date_updated);
        dateUpdated = data.date_updated;
      }
      console.info("Adding content:", data.content);
      articleContent += data.content;
    });

    return {
      title,
      authors: Array.from(authorSet),
      date_published: datePublished,
      date_updated: dateUpdated,
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
        date_published: new Date(),
        date_updated: null,
        hostname: getHostname(this.url),
        url: this.url,
        text: "",
      };
    }

    const { title, authors, date_published, date_updated, content } =
      smartParseResponse;
    // Convert date string to Date object
    // const datePublishedObject = parseDateString(date_published);
    let datePublishedObject = new Date();
    if (date_published) {
      datePublishedObject = new Date(date_published);
      console.info("Date published:", date_published);
    } else if (date_updated) {
      datePublishedObject = new Date(date_updated);
      console.info("Seting date published to date updated", date_updated);
    } else {
      console.info("No date published");
    }

    let dateUpdatedObject = null;
    if (date_updated) {
      dateUpdatedObject = new Date(date_updated);
      console.info("Date updated:", date_updated);
    } else {
      console.info("No date updated");
    }
    // const datePublishedObject = new Date(date_published);
    // if (!datePublishedObject) {
    //   console.error("Error parsing date string:", date_published);
    // }

    // const dateUpdatedObject = new Date(date_published);
    // if (!datePublishedObject) {
    //   console.error("Error parsing date string:", date_published);
    // }

    console.info("Smart Parse Response:", smartParseResponse);

    // Get properties before we clean
    const hostname = getHostname(this.url);
    const cleanedContent = this.postProcessContent(content);

    return {
      title,
      authors,
      date_published: datePublishedObject,
      date_updated: dateUpdatedObject,
      hostname,
      url: this.url,
      text: cleanedContent,
    };
  }
}
