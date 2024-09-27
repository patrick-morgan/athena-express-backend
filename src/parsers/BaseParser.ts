const cheerio = require("cheerio");
import { chunkContent, getHostname } from "./helpers";
import { ArticleData } from "../types";

export class BaseParser {
  protected url: string;
  protected $: cheerio.CheerioAPI;

  constructor(url: string, html: string) {
    this.url = url;
    this.$ = cheerio.load(html);
  }

  /**
   * @returns The title of the article
   */
  getTitle(): string {
    try {
      // Get the title of the article
      const $title = this.$("title");
      const titleText = $title.contents().first().text();
      return titleText;
    } catch (e) {
      console.error("Error getting title", e);
      return this.url;
    }
  }

  /**
   * @returns The author of the article
   */
  getAuthors(): string[] {
    // Default implementation, should be overridden
    return [];
  }

  /**
   * @returns The date the article was published
   */
  getDate(): Date {
    // Default implementation, return current date
    return new Date();
  }

  /**
   * Get the HTML content of the entire DOM
   * @returns The HTML content of the entire DOM
   */
  getHTML(): string {
    return this.$.html();
  }

  /**
   * Get the HTML content of the article
   * @returns The HTML content of the article
   */
  getArticleHTML(): string {
    const $articles = this.$("article");
    return $articles.html() || "";
  }

  /**
   * Removes any unwanted content from the article to prepare it for analysis
   */
  cleanContent(): void {
    // Default implementation, should be overridden
  }

  chunkHTML(): string[] {
    const chunks = chunkContent(this.getHTML());
    return chunks;
  }

  /**
   * Postprocess the content to remove whitespace and new lines
   */
  postProcessContent(content: string): string {
    // Remove excess whitespace and newlines
    const cleaned = content.replace(/\s\s+/g, " ").trim();

    return cleaned;
  }

  /**
   * @returns The content of the article
   */
  getContent(): string {
    // Default implementation, should be overridden
    return "";
  }

  /**
   * Parse the article and return the data
   * @returns The parsed article data
   */
  async parse(): Promise<ArticleData> {
    // Get properties before we clean
    const title = this.getTitle();
    const authors = this.getAuthors();
    const date_published = this.getDate();
    const hostname = getHostname(this.url);
    const content = this.getContent();
    const cleanedContent = this.postProcessContent(content);

    return {
      title,
      authors,
      date_published,
      date_updated: null,
      hostname,
      url: this.url,
      text: cleanedContent,
    };
  }
}
