import { ArticleData } from "../types";
import { BaseParser } from "./BaseParser";
import moment from "moment-timezone";

export class CNNParser extends BaseParser {
  /**
   * @returns The title of the article
   */
  getTitle(): string {
    const parsedTitle = super.getTitle();
    // CNN stores raw title in headline__text class inside h1 tag
    // CNN News articles contain `${title} | CNN Politics
    return parsedTitle.split("|")[0].trim();
  }

  /**
   * @returns The authors of the article
   */
  getAuthors(): string[] {
    const authors: string[] = [];
    this.$(".byline__name").each((i, author) => {
      authors.push(this.$(author).text().trim());
    });
    return authors;
  }

  /**
   * @returns The date the article was published
   */
  getDate(): Date {
    // Get article date from <div> tag with class .timestamp
    // and parent <div> tag with class .headline__byline-sub-text
    // This date string will be in format: "Updated 8:59 PM EDT, Mon July 1, 2024"
    const dateString = this.$(".headline__byline-sub-text .timestamp")
      .text()
      .trim();

    if (dateString) {
      // Remove the "Updated" prefix and any leading/trailing whitespace
      const cleanedDateString = dateString.replace("Updated", "").trim();

      // TODO: HANDLE TIMEZONES ACCORDINGLY
      // Parse the date string with moment-timezone
      const date = moment.tz(
        cleanedDateString,
        "h:mm A z, ddd MMM D, YYYY",
        "America/New_York"
      );

      return date.toDate();
    }

    // If no date is found, return current date
    return super.getDate();
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
    const $articles = this.$("article__content-container");
    return $articles.html() || "";
  }

  /**
   * Removes any unwanted content from the article to prepare it for analysis,
   * special cleaning for CNN hostname articles
   */
  cleanContent(): void {
    super.cleanContent();

    // Remove add feedback containers
    this.$(".ad-feedback__moda").remove();

    // Remove add wrappers
    this.$(".ad-slot-header__wrapper").remove();
    this.$(".ad-feedback-link").remove();
    this.$(".ad-slot__feedback").remove();
    this.$(".ad-feedback-link-container").remove();

    // Remove out source details that would show up in article content
    this.$(".source__location").remove();
    this.$(".source__text").remove();
  }

  /**
   * Get article content container specifically for CNN articles
   * @returns The content of the article
   */
  getContent(): string {
    const $articleBody = this.$(".article__content-container");
    return $articleBody.text() || "";
  }

  /**
   * Parse the article and return the data
   * @returns The parsed article data
   */
  parse(): ArticleData {
    return super.parse();
  }
}
