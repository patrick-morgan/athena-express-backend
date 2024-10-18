import { Decimal } from "@prisma/client/runtime/library";
import { prismaLocalClient } from "./app";
import {
  analyzeJournalistBias,
  JournalistAnalysisData,
} from "./prompts/chatgpt";
import { journalist_bias } from "@prisma/client";

export interface JournalistBiasWithName extends journalist_bias {
  name: string;
}

export async function analyzeJournalistById(
  journalistId: string
): Promise<JournalistBiasWithName> {
  console.log("analzying journalist", journalistId);
  const journalist = await prismaLocalClient.journalist.findFirst({
    where: { id: journalistId },
    include: { article_authors: true },
  });
  console.log("found journalist", journalist);

  if (!journalist) {
    throw new Error("Journalist not found");
  }

  const numArticlesWritten = journalist.article_authors.length;
  const existingBias = await prismaLocalClient.journalist_bias.findFirst({
    where: {
      journalist: journalist.id,
      num_articles_analyzed: numArticlesWritten,
    },
  });
  console.log("existing bias", existingBias);

  if (existingBias) {
    return { name: journalist.name, ...existingBias };
  }

  const articleIds = journalist.article_authors.map(
    (article) => article.article_id
  );
  const analysis: JournalistAnalysisData = {
    averagePolarization: 50,
    averageObjectivity: 50,
    summaries: [],
  };

  const polarizationBiases = await prismaLocalClient.polarization_bias.findMany(
    {
      where: { article_id: { in: articleIds } },
    }
  );

  if (polarizationBiases.length > 0) {
    const totalPolarizationBiasScore = polarizationBiases.reduce(
      (total, bias) => total.plus(bias.bias_score),
      new Decimal(0)
    );
    analysis.averagePolarization = parseFloat(
      totalPolarizationBiasScore.dividedBy(polarizationBiases.length).toFixed(1)
    );
  }

  const objectivityBiases = await prismaLocalClient.objectivity_bias.findMany({
    where: { article_id: { in: articleIds } },
  });

  if (objectivityBiases.length > 0) {
    const totalObjectivityBiasScore = objectivityBiases.reduce(
      (total, bias) => total.plus(bias.rhetoric_score),
      new Decimal(0)
    );
    analysis.averageObjectivity = parseFloat(
      totalObjectivityBiasScore.dividedBy(objectivityBiases.length).toFixed(1)
    );
  }

  const summaries = await prismaLocalClient.summary.findMany({
    where: { article_id: { in: articleIds } },
  });
  analysis.summaries = summaries.map((summary) => summary.summary);

  const journalistAnalysis = await analyzeJournalistBias(analysis);
  if (!journalistAnalysis) {
    throw new Error("Error analyzing journalist bias");
  }

  const newJournalistBias = await prismaLocalClient.journalist_bias.create({
    data: {
      journalist: journalist.id,
      num_articles_analyzed: numArticlesWritten,
      rhetoric_score: analysis.averageObjectivity,
      bias_score: analysis.averagePolarization,
      summary: journalistAnalysis.analysis,
    },
  });

  return { name: journalist.name, ...newJournalistBias };
}
