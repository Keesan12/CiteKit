export type WorkspacePlan = "oss" | "starter" | "growth" | "agency";
export type ProbeEngineName = "gpt4o" | "claude" | "perplexity" | "gemini" | "grok";
export type WorkflowId =
  | "WF-01"
  | "WF-02"
  | "WF-03"
  | "WF-04"
  | "WF-05"
  | "WF-06"
  | "WF-07"
  | "WF-08"
  | "WF-09"
  | "WF-10"
  | "WF-11"
  | "WF-12"
  | "WF-13"
  | "WF-14"
  | "WF-15"
  | "WF-16"
  | "WF-17"
  | "WF-18"
  | "WF-19"
  | "WF-20";
export type WorkflowTier = 1 | 2 | 3 | 4 | 5;
export type WorkflowStageName = "probe" | "diagnose" | "fix" | "verify";
export type WorkflowRunStatus = "queued" | "running" | "completed" | "failed" | "blocked";
export type PromptIntent =
  | "best_tool"
  | "comparison"
  | "alternative"
  | "use_case"
  | "pricing"
  | "integration"
  | "compliance";
export type RecommendationStatus =
  | "won"
  | "visible"
  | "at_risk"
  | "lost"
  | "wrong"
  | "unanswerable";
export type FixStatus = "draft" | "approved" | "rejected" | "deployed";
export type GapIssueType =
  | "missing_page"
  | "weak_schema"
  | "no_comparison"
  | "stale_content"
  | "weak_authority"
  | "missing_stats"
  | "no_third_party_proof"
  | "poor_docs"
  | "missing_pricing"
  | "no_llms_txt"
  | "no_reddit_presence"
  | "no_earned_media"
  | "weak_author_authority";
export type FixType =
  | "faq"
  | "schema"
  | "comparison_page"
  | "docs_update"
  | "llms_txt"
  | "homepage_section"
  | "g2_brief"
  | "earned_media_brief"
  | "reddit_brief";

export interface WorkspaceRecord {
  id: string;
  name: string;
  owner_user_id: string;
  plan_tier: WorkspacePlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface BrandRecord {
  id: string;
  workspace_id: string;
  name: string;
  domain: string;
  category: string | null;
  description: string | null;
  target_persona: string | null;
  cms_config: Record<string, unknown>;
  github_config: Record<string, unknown>;
  public_slug: string | null;
  created_at: string;
}

export interface CompetitorRecord {
  id: string;
  brand_id: string;
  name: string;
  domain: string | null;
  notes: string | null;
}

export interface PromptRecord {
  id: string;
  brand_id: string;
  prompt_text: string;
  intent_type: PromptIntent;
  buyer_stage: string | null;
  priority: number;
  active: boolean;
  created_at: string;
}

export interface WorkflowRunRecord {
  id: string;
  brand_id: string;
  prompt_id: string | null;
  workflow_id: WorkflowId;
  tier: WorkflowTier;
  status: WorkflowRunStatus;
  current_stage: WorkflowStageName;
  oss_safe: boolean;
  score: number | null;
  summary: string | null;
  result_json: Record<string, unknown>;
  trace_metadata: Record<string, unknown>;
  requires_human_approval: boolean;
  last_error: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface ProbeRunRecord {
  id: string;
  brand_id: string;
  prompt_id: string;
  workflow_run_id: string | null;
  workflow_id: WorkflowId | null;
  workflow_stage: WorkflowStageName | null;
  engine: ProbeEngineName;
  raw_response: string | null;
  normalized_answer: string | null;
  citations_json: unknown[];
  mentions_json: unknown[];
  claimed_urls_json: unknown[];
  off_site_sources_json: unknown[];
  sentiment: "positive" | "neutral" | "negative" | null;
  cost_usd: number;
  latency_ms: number | null;
  martin_loop_trace_id: string | null;
  created_at: string;
}

export interface VisibilityScoreRecord {
  id: string;
  probe_run_id: string;
  brand_id: string;
  workflow_run_id: string | null;
  workflow_id: WorkflowId | null;
  brand_mentioned: boolean;
  brand_cited: boolean;
  brand_position: number | null;
  recommendation_status: RecommendationStatus;
  competitor_mentions_json: string[];
  competitor_citations_json: string[];
  citation_share: number;
  created_at: string;
}

export interface SitePageRecord {
  id: string;
  brand_id: string;
  url: string;
  title: string | null;
  content_hash: string | null;
  markdown_content: string | null;
  schema_json_existing: Record<string, unknown>;
  llms_txt_exists: boolean;
  crawled_at: string;
}

export interface DiagnosisRecord {
  id: string;
  brand_id: string;
  prompt_id: string | null;
  workflow_run_id: string | null;
  workflow_id: WorkflowId | null;
  engine: ProbeEngineName | null;
  issue_type: GapIssueType;
  severity: number;
  explanation: string | null;
  competitor_advantage: string | null;
  recommended_fix_type: FixType | null;
  sansa_predicted_lift: number | null;
  sansa_confidence: number | null;
  martin_loop_trace_id: string | null;
  trace_metadata: Record<string, unknown>;
  created_at: string;
}

export interface FixRecord {
  id: string;
  diagnosis_id: string | null;
  brand_id: string;
  workflow_run_id: string | null;
  workflow_id: WorkflowId | null;
  fix_type: FixType;
  draft_content: string | null;
  status: FixStatus;
  github_pr_url: string | null;
  cms_draft_url: string | null;
  deployed_at: string | null;
  martin_loop_trace_id: string | null;
  trace_metadata: Record<string, unknown>;
  estimated_citation_lift: number | null;
  attribution_confidence: number | null;
  requires_human_approval: boolean;
  created_at: string;
}

export interface ExperimentRecord {
  id: string;
  brand_id: string;
  fix_id: string | null;
  workflow_run_id: string | null;
  workflow_id: WorkflowId | null;
  before_probe_run_ids: string[];
  after_probe_run_ids: string[];
  citation_delta: number | null;
  result: "won" | "neutral" | "lost" | null;
  sansa_predicted_lift: number | null;
  sansa_was_correct: boolean | null;
  trace_metadata: Record<string, unknown>;
  measured_citation_lift: number | null;
  attribution_confidence: number | null;
  before_citation_share: number | null;
  after_citation_share: number | null;
  created_at: string;
}

export interface MartinLoopTraceRecord {
  id: string;
  agent_name: string;
  brand_id: string | null;
  workflow_run_id: string | null;
  workflow_id: WorkflowId | null;
  workflow_stage: WorkflowStageName | null;
  action_type: string | null;
  input_hash: string | null;
  output_hash: string | null;
  cost_usd: number;
  latency_ms: number | null;
  success: boolean;
  error_message: string | null;
  sansa_used: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}
