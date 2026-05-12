import { z } from "zod";
import type { FixType, GapIssueType, PromptIntent, RecommendationStatus } from "../db/types";
import { WORKFLOW_IDS, WORKFLOW_STAGE_NAMES } from "../workflows/types";

const PROMPT_INTENTS = [
  "best_tool",
  "comparison",
  "alternative",
  "use_case",
  "pricing",
  "integration",
  "compliance",
] as const satisfies readonly PromptIntent[];

const GAP_ISSUE_TYPES = [
  "missing_page",
  "weak_schema",
  "no_comparison",
  "stale_content",
  "weak_authority",
  "missing_stats",
  "no_third_party_proof",
  "poor_docs",
  "missing_pricing",
  "no_llms_txt",
  "no_reddit_presence",
  "no_earned_media",
  "weak_author_authority",
] as const satisfies readonly GapIssueType[];

const FIX_TYPES = [
  "faq",
  "schema",
  "comparison_page",
  "docs_update",
  "llms_txt",
  "homepage_section",
  "g2_brief",
  "earned_media_brief",
  "reddit_brief",
] as const satisfies readonly FixType[];

const RECOMMENDATION_STATUSES = [
  "won",
  "visible",
  "at_risk",
  "lost",
  "wrong",
  "unanswerable",
] as const satisfies readonly RecommendationStatus[];

export const OffSiteSourceSchema = z.enum([
  "reddit",
  "g2",
  "capterra",
  "wikipedia",
  "trustradius",
  "hackernews",
  "twitter",
  "other",
]);

export const CitationExtractionSchema = z.object({
  brands_mentioned: z.array(z.string().min(1)).default([]),
  brands_cited: z.array(z.string().min(1)).default([]),
  cited_urls: z.array(z.string().url()).default([]),
  off_site_sources: z.array(OffSiteSourceSchema).default([]),
  sentiment: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  recommendation_winner: z.string().nullable().default(null),
  missing_brands: z.array(z.string().min(1)).default([]),
});

export const BrandSeedSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().min(2),
  domain: z.string().min(3),
  category: z.string().optional(),
  description: z.string().optional(),
  targetPersona: z.string().optional(),
  competitors: z.array(z.object({ name: z.string().min(1), domain: z.string().min(1).optional() })).default([]),
});

export const PromptDraftSchema = z.object({
  prompt_text: z.string().min(5),
  intent_type: z.enum(PROMPT_INTENTS),
  buyer_stage: z.string().nullable().default(null),
  priority: z.number().int().min(1).max(10).default(5),
});

export const WorkflowAttributionSchema = z.object({
  workflow_id: z.enum(WORKFLOW_IDS),
  stage: z.enum(WORKFLOW_STAGE_NAMES).optional(),
  trace_event: z.string().min(1).optional(),
  trace_id: z.string().min(1).optional(),
});

export const DiagnosisGapSchema = z.object({
  issue_type: z.enum(GAP_ISSUE_TYPES),
  severity: z.number().int().min(1).max(10),
  explanation: z.string().min(1),
  competitor_advantage: z.string().min(1),
  recommended_fix_type: z.enum(FIX_TYPES),
  workflow_attribution: WorkflowAttributionSchema.optional(),
});

export const DiagnosisResultSchema = z.object({
  gaps: z.array(DiagnosisGapSchema).min(1),
});

export const GeneratedFixSchema = z.object({
  fix_type: z.enum(FIX_TYPES),
  title: z.string().min(3),
  draft_content: z.string().min(10),
  workflow_attribution: WorkflowAttributionSchema.optional(),
});

export const VisibilityScoreSchema = z.object({
  brand_mentioned: z.boolean(),
  brand_cited: z.boolean(),
  brand_position: z.number().int().nullable(),
  recommendation_status: z.enum(RECOMMENDATION_STATUSES),
  competitor_mentions: z.array(z.string()).default([]),
  competitor_citations: z.array(z.string()).default([]),
  citation_share: z.number().min(0).max(1),
});

export type CitationExtraction = z.infer<typeof CitationExtractionSchema>;
export type BrandSeed = z.infer<typeof BrandSeedSchema>;
export type PromptDraft = z.infer<typeof PromptDraftSchema>;
export type WorkflowAttribution = z.infer<typeof WorkflowAttributionSchema>;
export type DiagnosisGap = z.infer<typeof DiagnosisGapSchema>;
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;
export type GeneratedFix = z.infer<typeof GeneratedFixSchema>;
export type VisibilityScore = z.infer<typeof VisibilityScoreSchema>;
