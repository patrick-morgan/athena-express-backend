export type ArticleData = {
  title: string;
  date_published: Date;
  date_updated: Date | null;
  authors: string[];
  text?: string;
  url: string;
  hostname: string;
};
