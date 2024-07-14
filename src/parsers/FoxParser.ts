import { ArticleData } from "../types";
import { BaseParser } from "./BaseParser";
import moment from "moment-timezone";

export class FoxParser extends BaseParser {
  /**
   * @returns The title of the article
   */
  getTitle(): string {
    const parsedTitle = super.getTitle();
    // Looks like best way to get the title is actually through h1, not sure how transferrable this is
    // Fox News articles contain | Fox News at end (e.g. Biden angered, distracted by political attacks on his family: 'Impenetrable sadness' | Fox News)
    return parsedTitle.split("|")[0].trim();
  }

  /**
   * @returns The author of the article
   */
  getAuthors(): string[] {
    const authors: string[] = [];
    // The authors will be inside the .author-byline class
    this.$(".author-byline").each((i, author) => {
      // grab the text out of the <a> tag within the .author-byline div
      // but don't get <a> tag with a parent <span> with class .article-source
      const authorText = this.$(author)
        .find("a")
        .not(".article-source a")
        .text()
        .trim();
      authors.push(authorText);
    });
    return authors;
  }

  /**
   * @returns The date the article was published
   */
  getDate(): Date {
    // Get article date from <time> tag inside the span with class .article-date
    // This date string will be in format: "July 2, 2024 7:04am EDT"
    const dateString = this.$(".article-date time").text();

    if (dateString) {
      // TODO: HANDLE TIMEZONES ACCORDINGLY
      // Parse the date string with moment-timezone
      const date = moment.tz(
        dateString,
        "MMMM D, YYYY h:mma",
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
    const $articles = this.$("article");
    return $articles.html() || "";
  }

  /**
   * Removes any unwanted content from the article to prepare it for analysis,
   * special cleaning for Fox News hostname articles
   */
  cleanContent(): void {
    super.cleanContent();

    // For now assume the article content is going to be inside article tag
    // Clean article tags
    const $articles = this.$("article");

    // Remove id, name, class from article tags
    $articles.each((i, article) => {
      const $article = this.$(article);
      $article.removeClass();
      $article.removeAttr("id");
      $article.removeAttr("name");
      $article.removeAttr("class");
    });

    // Get all anchor tags
    const $anchors = this.$("a");
    // Remove anchors with children 'strong' tags because they are just garbage 'CLICK HERE' links
    $anchors.each((i, anchor) => {
      const $anchor = this.$(anchor);
      if ($anchor.find("strong").length > 0) {
        $anchor.remove();
      }
    });
    // Remove divs with class 'ad-container' for removing Fox news adds
    this.$(".ad-container").remove();
    // Remove divs with class 'caption' as these are photo captions
    this.$(".caption").remove();

    // Remove video-container as it will contain string "Video"
    this.$(".video-container").remove();

    // Remove class control
    this.$(".control").remove();

    // Remove author-bio as it isn't helpful for now
    this.$(".author-bio").remove();
  }

  /**
   * Get article body content specifically for Fox News articles
   * @returns The content of the article
   */
  getContent(): string {
    // Get article-body to get body of Fox news articles (this will remove out title, author, date, etc.)
    const $articleBody = this.$(".article-body");
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
