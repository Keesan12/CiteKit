import type { BrandRecord, CompetitorRecord } from "../db/types";
import { VisibilityScoreSchema, type CitationExtraction, type VisibilityScore } from "../schema/core";
import { normalizeDomain } from "../utils/slug";

function findDomainMatches(urls: string[], domain: string): boolean {
  const normalizedDomain = normalizeDomain(domain);
  return urls.some((url) => normalizeDomain(url).includes(normalizedDomain));
}

export function scoreExtraction(
  brand: Pick<BrandRecord, "name" | "domain">,
  competitors: Pick<CompetitorRecord, "name" | "domain">[],
  extraction: CitationExtraction,
): VisibilityScore {
  const brandMentioned = extraction.brands_mentioned.some(
    (candidate) => candidate.toLowerCase() === brand.name.toLowerCase(),
  );
  const brandCitedByName = extraction.brands_cited.some(
    (candidate) => candidate.toLowerCase() === brand.name.toLowerCase(),
  );
  const brandCitedByUrl = findDomainMatches(extraction.cited_urls, brand.domain);
  const brandCited = brandCitedByName || brandCitedByUrl;

  const competitorMentions = competitors
    .filter((competitor) =>
      extraction.brands_mentioned.some((candidate) => candidate.toLowerCase() === competitor.name.toLowerCase()),
    )
    .map((competitor) => competitor.name);

  const competitorCitations = competitors
    .filter(
      (competitor) =>
        extraction.brands_cited.some((candidate) => candidate.toLowerCase() === competitor.name.toLowerCase()) ||
        (competitor.domain ? findDomainMatches(extraction.cited_urls, competitor.domain) : false),
    )
    .map((competitor) => competitor.name);

  const trackedEntities = [brand.name, ...competitors.map((competitor) => competitor.name)];
  const recommendationWinner = extraction.recommendation_winner?.toLowerCase() ?? null;
  const winnerIsTracked = recommendationWinner
    ? trackedEntities.some((entity) => entity.toLowerCase() === recommendationWinner)
    : false;

  let recommendationStatus: VisibilityScore["recommendation_status"];
  if (recommendationWinner === brand.name.toLowerCase()) {
    recommendationStatus = "won";
  } else if (brandCited) {
    recommendationStatus = "visible";
  } else if (brandMentioned) {
    recommendationStatus = "at_risk";
  } else if (winnerIsTracked) {
    recommendationStatus = "lost";
  } else if (extraction.brands_mentioned.length === 0 && extraction.cited_urls.length === 0) {
    recommendationStatus = "unanswerable";
  } else {
    recommendationStatus = "wrong";
  }

  const citationUniverse = new Set([
    ...extraction.brands_cited.map((value) => value.toLowerCase()),
    ...competitorCitations.map((value) => value.toLowerCase()),
    ...(brandCited ? [brand.name.toLowerCase()] : []),
  ]);

  const citationShare = citationUniverse.size === 0 ? 0 : Number((brandCited ? 1 / citationUniverse.size : 0).toFixed(4));
  const brandPosition = extraction.brands_mentioned.findIndex(
    (candidate) => candidate.toLowerCase() === brand.name.toLowerCase(),
  );

  return VisibilityScoreSchema.parse({
    brand_mentioned: brandMentioned,
    brand_cited: brandCited,
    brand_position: brandPosition === -1 ? null : brandPosition + 1,
    recommendation_status: recommendationStatus,
    competitor_mentions: competitorMentions,
    competitor_citations: competitorCitations,
    citation_share: citationShare,
  });
}

