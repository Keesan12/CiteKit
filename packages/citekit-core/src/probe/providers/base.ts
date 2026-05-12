import { CitationExtractionSchema, type CitationExtraction } from "../../schema/core";
import { extractJsonObject, safeJsonParse } from "../../utils/json";
import { extractUrlsFromText, normalizeWhitespace } from "../../utils/text";
import type { ProbeExecutionContext } from "../types";

export function fallbackExtraction(rawAnswer: string, context: ProbeExecutionContext): CitationExtraction {
  const normalized = normalizeWhitespace(rawAnswer);
  const lower = normalized.toLowerCase();
  const brandNames = [context.brand.name, ...(context.competitors ?? []).map((competitor) => competitor.name)].filter(Boolean);
  const brandsMentioned = brandNames.filter((name) => lower.includes(name.toLowerCase()));
  const citedUrls = extractUrlsFromText(rawAnswer);
  const brandsCited = brandsMentioned.filter((name) =>
    citedUrls.some((url) => url.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, ""))),
  );

  const winner = brandsMentioned[0] ?? null;
  const offSiteSources = citedUrls.flatMap((url) => {
    const matchers: Record<string, CitationExtraction["off_site_sources"][number]> = {
      reddit: "reddit",
      g2: "g2",
      capterra: "capterra",
      wikipedia: "wikipedia",
      trustradius: "trustradius",
      "news.ycombinator": "hackernews",
      twitter: "twitter",
      "x.com": "twitter",
    };

    for (const [needle, source] of Object.entries(matchers)) {
      if (url.includes(needle)) {
        return [source];
      }
    }
    return [];
  });

  return CitationExtractionSchema.parse({
    brands_mentioned: brandsMentioned,
    brands_cited: brandsCited,
    cited_urls: citedUrls,
    off_site_sources: Array.from(new Set(offSiteSources)),
    sentiment: "neutral",
    recommendation_winner: winner,
    missing_brands: brandsMentioned.includes(context.brand.name) ? [] : [context.brand.name],
  });
}

export function parseJsonExtraction(text: string): CitationExtraction | null {
  const candidate = extractJsonObject(text);
  if (!candidate) {
    return null;
  }

  const parsed = safeJsonParse<unknown>(candidate);
  const result = CitationExtractionSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

