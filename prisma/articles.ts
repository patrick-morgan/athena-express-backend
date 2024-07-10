import { prismaLocalClient } from "../src/app";

export type CreateArticleInput = {
  articleData: {
    title: string;
    content: string;
    summary: string;
    objectivity: number;
    politicalBias: number;
  };
};

// export const createArticle = async ({
//   articleData,
// }: CreateArticleInput): Promise<any | null> => {
//   const article = await prismaLocalClient.article.create({
//     data: {
//       title: articleData.title,
//       content: articleData.content,
//       summary: articleData.summary,
//       objectivity: articleData.objectivity,
//       political_bias: articleData.politicalBias,
//     },
//   });
// };
