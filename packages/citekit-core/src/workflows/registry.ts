import type { WorkflowId, WorkflowTier, WorkspacePlan } from "../db/types";
import {
  WORKFLOW_STAGE_NAMES,
  WorkflowMetaSchema,
  type WorkflowMeta,
} from "./types";

const WORKFLOW_REGISTRY_SOURCE = [
  {
    id: "WF-01",
    name: "llms.txt Deployment",
    tier: 1,
    summary: "Ensure root /llms.txt and /llms-full.txt exist, are well-formed, and curated.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "llms_txt",
    sansa_signals: ["llms_txt.lift"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-02",
    name: "AI Crawler Access Audit",
    tier: 1,
    summary: "Ensure AI crawlers can access the site and detect WAF or robots blocks.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "crawler_access",
    sansa_signals: ["crawler_access.bot_hits"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-03",
    name: "Schema.org Coverage Audit",
    tier: 1,
    summary: "Audit JSON-LD coverage for entity, product, FAQ, article, and software schemas.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "schema",
    sansa_signals: ["schema.rich_results", "schema.entity_lift"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-04",
    name: "SSR/Crawlability Audit",
    tier: 1,
    summary: "Ensure high-value pages render content server-side for non-JS assistant crawlers.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "ssr",
    sansa_signals: ["ssr.parity_lift"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-05",
    name: "Answer-First Restructuring",
    tier: 2,
    summary: "Lead pages with direct answers before narrative or marketing preamble.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "answer_first",
    sansa_signals: ["answer_first.citation_lift"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-06",
    name: "Question-Shaped H2 Conversion",
    tier: 2,
    summary: "Rewrite headers into question form that mirrors user prompt phrasing.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "question_h2",
    sansa_signals: ["question_h2.rank_delta"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-07",
    name: "Comparison/VS Page Generation",
    tier: 2,
    summary: "Draft structured comparison pages for versus and best-in-category prompts.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "comparison",
    sansa_signals: ["comparison.sov_shift"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-08",
    name: "Freshness Signals",
    tier: 2,
    summary: "Add dateModified schema, visible timestamps, and stale-content prioritization.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "freshness",
    sansa_signals: ["freshness.recrawl"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-09",
    name: "Original Data/Research Generation",
    tier: 2,
    summary: "Propose proprietary benchmarks, studies, and datasets that create citation moats.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "original_data",
    sansa_signals: ["original_data.long_horizon"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-10",
    name: "Wikipedia/Wikidata Presence",
    tier: 3,
    summary: "Assess entity coverage, notability readiness, and Wikidata enrichment paths.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "wikidata",
    sansa_signals: ["wikidata.grounding_lift"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-11",
    name: "Author Entity Graph",
    tier: 3,
    summary: "Strengthen author schema and sameAs chains across content and profile surfaces.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "author",
    sansa_signals: ["author.entity_recognized"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-12",
    name: "Forum Seeding (Reddit/Quora/Stack Exchange)",
    tier: 3,
    summary: "Create a human-reviewed queue for authentic forum participation and contribution.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "forum_seed",
    sansa_signals: ["forum_seed.attribution"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-13",
    name: "YouTube Transcript & Podcast Distribution",
    tier: 3,
    summary: "Improve transcript coverage and distribution across audio and video surfaces.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "audio_video",
    sansa_signals: ["audio_video.transcript_citations"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-14",
    name: "Semantic HTML Audit",
    tier: 4,
    summary: "Increase semantic landmark coverage to improve chunking and crawl comprehension.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "semantic_html",
    sansa_signals: ["semantic_html.chunk_quality"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-15",
    name: "Sitemap + RSS + IndexNow",
    tier: 4,
    summary: "Maintain crawl feeds, sitemap freshness, and faster re-indexing signals.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "sitemap",
    sansa_signals: ["sitemap.crawl_frequency"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-16",
    name: "Core Web Vitals",
    tier: 4,
    summary: "Prioritize performance fixes that preserve crawl reliability and fast retrieval.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "cwv",
    sansa_signals: ["cwv.metric_delta"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-17",
    name: "Canonical/URL Hygiene",
    tier: 4,
    summary: "Consolidate duplicate URLs and enforce canonical signal hygiene.",
    oss_safe: true,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "url_hygiene",
    sansa_signals: ["url_hygiene.consolidation"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-18",
    name: "Citation Monitoring Loop",
    tier: 5,
    summary: "Probe target prompts across engines and route measured gaps into follow-up workflows.",
    oss_safe: false,
    requires_human_approval_for_fix: false,
    trace_event_prefix: "citation_monitor",
    sansa_signals: ["citation_monitor.sov_trend", "citation_monitor.attribution"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-19",
    name: "Citation Diversification",
    tier: 5,
    summary: "Expand citation presence across review sites, directories, GitHub, and curated lists.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "diversification",
    sansa_signals: ["diversification.diversity_score"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
  {
    id: "WF-20",
    name: "Public Scoreboard / Proof Cards",
    tier: 5,
    summary: "Generate public proof assets and score outputs that compound CiteOps authority.",
    oss_safe: false,
    requires_human_approval_for_fix: true,
    trace_event_prefix: "scoreboard",
    sansa_signals: ["scoreboard.recursive_authority", "scoreboard.backlink_growth"],
    stages: [...WORKFLOW_STAGE_NAMES],
  },
] as const satisfies readonly WorkflowMeta[];

export const WORKFLOW_REGISTRY = WORKFLOW_REGISTRY_SOURCE.map((workflow) =>
  WorkflowMetaSchema.parse(workflow),
);

const WORKFLOW_REGISTRY_MAP = new Map<WorkflowId, WorkflowMeta>(
  WORKFLOW_REGISTRY.map((workflow) => [workflow.id, workflow]),
);

export function listWorkflows(): readonly WorkflowMeta[] {
  return WORKFLOW_REGISTRY;
}

export function getWorkflowMeta(workflowId: WorkflowId): WorkflowMeta | undefined {
  return WORKFLOW_REGISTRY_MAP.get(workflowId);
}

export function listWorkflowsByTier(tier: WorkflowTier): WorkflowMeta[] {
  return WORKFLOW_REGISTRY.filter((workflow) => workflow.tier === tier);
}

export function listOssSafeWorkflows(): WorkflowMeta[] {
  return WORKFLOW_REGISTRY.filter((workflow) => workflow.oss_safe);
}

export function isWorkflowOssSafe(workflowId: WorkflowId): boolean {
  return getWorkflowMeta(workflowId)?.oss_safe ?? false;
}

export function canRunWorkflowOnPlan(planTier: WorkspacePlan, workflowId: WorkflowId): boolean {
  const workflow = getWorkflowMeta(workflowId);
  if (!workflow) {
    return false;
  }

  if (planTier === "oss") {
    return workflow.oss_safe;
  }

  return true;
}
