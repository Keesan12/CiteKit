import type { BrandRecord, CompetitorRecord, PromptRecord, ProbeEngineName } from "../db/types";
import { DiagnosisResultSchema, type CitationExtraction, type DiagnosisGap } from "../schema/core";
import type { CrawlResult } from "../crawl/site-crawler";
import { includesAny } from "../utils/text";

export interface DiagnosisInput {
  brand: Pick<BrandRecord, "name" | "domain" | "category" | "description" | "target_persona">;
  prompt?: Pick<PromptRecord, "id" | "prompt_text" | "intent_type">;
  engine?: ProbeEngineName;
  competitors: Pick<CompetitorRecord, "name" | "domain">[];
  extraction: CitationExtraction;
  site: CrawlResult;
}

function averageSeverity(base: number, extraction: CitationExtraction): number {
  const citedPenalty = extraction.brands_cited.length > 0 ? -1 : 1;
  return Math.min(10, Math.max(1, base + citedPenalty));
}

export function diagnoseBrand(input: DiagnosisInput): DiagnosisGap[] {
  const gaps: DiagnosisGap[] = [];
  const allText = input.site.pages.map((page) => page.markdownContent).join("\n").toLowerCase();
  const urls = input.site.pages.map((page) => page.url.toLowerCase());
  const currentYearMentioned = /\b202[45-6]\b/.test(allText);
  const hasSchema = input.site.pages.some((page) => page.schemaJsonExisting.length > 0);
  const hasPricingPage = urls.some((url) => /pricing|plans|plan/i.test(url));
  const hasDocsPage = urls.some((url) => /docs|documentation|guide|api/i.test(url));
  const hasStats = /\b\d+(\.\d+)?(%|x|ms|mrr|hours?|days?|customers?|teams?)\b/i.test(allText);
  const hasComparisonPage =
    urls.some((url) => /compare|versus|\/vs\//i.test(url)) ||
    input.competitors.some((competitor) => includesAny(allText, [competitor.name.toLowerCase()]));
  const offSite = new Set(input.extraction.off_site_sources);
  const hasEarnedMedia = offSite.has("wikipedia") || offSite.has("hackernews") || offSite.has("other");
  const hasThirdPartyProof = offSite.has("g2") || offSite.has("capterra") || offSite.has("trustradius");
  const hasRedditPresence = offSite.has("reddit");
  const authorSignals = includesAny(allText, ["author", "written by", "editor", "contributor"]);

  if (!input.site.llmsTxtExists) {
    gaps.push({
      issue_type: "no_llms_txt",
      severity: averageSeverity(8, input.extraction),
      explanation: "The site does not expose an llms.txt file, making AI-targeted crawl guidance unavailable.",
      competitor_advantage: "Competitors can expose cleaner crawl and summarization instructions to assistant crawlers.",
      recommended_fix_type: "llms_txt",
    });
  }

  if (!hasSchema) {
    gaps.push({
      issue_type: "weak_schema",
      severity: averageSeverity(8, input.extraction),
      explanation: "No JSON-LD schema was detected across crawled pages.",
      competitor_advantage: "Structured entities are easier for assistants to trust and cite.",
      recommended_fix_type: "schema",
    });
  }

  if (!hasComparisonPage) {
    gaps.push({
      issue_type: "no_comparison",
      severity: averageSeverity(7, input.extraction),
      explanation: "The crawl did not find a comparison page or direct competitive framing.",
      competitor_advantage: "Competitors with explicit versus content are easier to surface for decision-stage prompts.",
      recommended_fix_type: "comparison_page",
    });
  }

  if (!currentYearMentioned) {
    gaps.push({
      issue_type: "stale_content",
      severity: averageSeverity(6, input.extraction),
      explanation: "The crawled content lacks a visible recency signal such as current-year references.",
      competitor_advantage: "Fresh pages are more likely to survive LLM confidence filtering.",
      recommended_fix_type: "docs_update",
    });
  }

  if (!hasStats) {
    gaps.push({
      issue_type: "missing_stats",
      severity: averageSeverity(6, input.extraction),
      explanation: "The site lacks concrete numeric proof points in the crawled content.",
      competitor_advantage: "Quantified claims strengthen citation confidence and recommendation quality.",
      recommended_fix_type: "homepage_section",
    });
  }

  if (!hasThirdPartyProof) {
    gaps.push({
      issue_type: "no_third_party_proof",
      severity: averageSeverity(8, input.extraction),
      explanation: "The answer set lacks external review-site support such as G2 or Capterra.",
      competitor_advantage: "Third-party proof is disproportionately cited for buyer trust questions.",
      recommended_fix_type: "g2_brief",
    });
  }

  if (!hasDocsPage) {
    gaps.push({
      issue_type: "poor_docs",
      severity: averageSeverity(5, input.extraction),
      explanation: "The crawl did not discover a documentation surface with durable answer content.",
      competitor_advantage: "Docs-heavy competitors expose more answerable material for assistants.",
      recommended_fix_type: "docs_update",
    });
  }

  if (!hasPricingPage) {
    gaps.push({
      issue_type: "missing_pricing",
      severity: averageSeverity(8, input.extraction),
      explanation: "No pricing or plan page was discovered in the crawl.",
      competitor_advantage: "Pricing transparency helps LLMs answer cost and worth-it questions without deferring.",
      recommended_fix_type: "homepage_section",
    });
  }

  if (!hasRedditPresence) {
    gaps.push({
      issue_type: "no_reddit_presence",
      severity: averageSeverity(5, input.extraction),
      explanation: "The answer set did not reference Reddit or other community discussion validating the brand.",
      competitor_advantage: "Community references often dominate conversational recommendations.",
      recommended_fix_type: "reddit_brief",
    });
  }

  if (!hasEarnedMedia) {
    gaps.push({
      issue_type: "no_earned_media",
      severity: averageSeverity(6, input.extraction),
      explanation: "The answer set lacks earned media or independent editorial references.",
      competitor_advantage: "Editorial coverage widens citation diversity and trust.",
      recommended_fix_type: "earned_media_brief",
    });
  }

  if (!authorSignals) {
    gaps.push({
      issue_type: "weak_author_authority",
      severity: averageSeverity(4, input.extraction),
      explanation: "The site does not surface strong author or editorial authority signals in crawled copy.",
      competitor_advantage: "Named authors and expert signals improve perceived source quality.",
      recommended_fix_type: "docs_update",
    });
  }

  if (input.site.pages.length < 3) {
    gaps.push({
      issue_type: "missing_page",
      severity: averageSeverity(5, input.extraction),
      explanation: "The crawl found too few substantive pages for a rich answer surface.",
      competitor_advantage: "Competitors with broader indexable coverage are easier for assistants to cite accurately.",
      recommended_fix_type: "homepage_section",
    });
  }

  if (input.extraction.off_site_sources.length === 0) {
    gaps.push({
      issue_type: "weak_authority",
      severity: averageSeverity(7, input.extraction),
      explanation: "The answer set contained no independent off-site sources tied to the brand.",
      competitor_advantage: "Authority compounds when assistants can triangulate your claims from multiple domains.",
      recommended_fix_type: "earned_media_brief",
    });
  }

  return DiagnosisResultSchema.parse({ gaps }).gaps;
}

