import type { CitationMonitoringReport, CitationMonitoringResult, RoutedWorkflow } from "./types";

export interface MonitoringPersistenceOptions {
  includeRawResponses?: boolean;
}

export interface MonitoringProbeRunInsert {
  brand_id: string;
  prompt_id: string;
  workflow_run_id: string | null;
  workflow_id: "WF-18";
  workflow_stage: "probe";
  engine: string;
  raw_response: string | null;
  normalized_answer: string | null;
  citations_json: string[];
  mentions_json: string[];
  claimed_urls_json: string[];
  off_site_sources_json: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
  cost_usd: number;
  latency_ms: number | null;
  trace_metadata: Record<string, unknown>;
}

export interface MonitoringScoreInsert {
  brand_id: string;
  prompt_id: string;
  workflow_id: "WF-18";
  engine: string;
  brand_mentioned: boolean;
  brand_cited: boolean;
  brand_position: number | null;
  recommendation_status: string;
  competitor_mentions_json: string[];
  competitor_citations_json: string[];
  citation_share: number;
}

export interface MonitoringSnapshotInsert {
  brand_id: string;
  workflow_id: "WF-18";
  generated_at: string;
  prompt_count: number;
  provider_count: number;
  total_run_count: number;
  successful_run_count: number;
  failed_run_count: number;
  brand_mention_rate: number;
  brand_citation_rate: number;
  average_citation_share: number;
  volatility: number;
  confidence: number;
  snapshot_json: Record<string, unknown>;
}

export interface MonitoringRouteInsert {
  brand_id: string;
  workflow_id: RoutedWorkflow["workflowId"];
  source_workflow_id: "WF-18";
  reason: string;
  priority: number;
  requires_hosted_execution: boolean;
  status: "queued";
}

export interface MonitoringPersistenceBatch {
  probeRuns: MonitoringProbeRunInsert[];
  scores: MonitoringScoreInsert[];
  snapshot: MonitoringSnapshotInsert;
  routes: MonitoringRouteInsert[];
}

export interface MonitoringStore {
  saveMonitoringReport(batch: MonitoringPersistenceBatch): Promise<void>;
}

function successResults(report: CitationMonitoringReport) {
  return report.results.filter((result): result is Extract<CitationMonitoringResult, { status: "success" }> =>
    result.status === "success",
  );
}

export function buildMonitoringPersistenceBatch(
  report: CitationMonitoringReport,
  options: MonitoringPersistenceOptions = {},
): MonitoringPersistenceBatch {
  const includeRawResponses = options.includeRawResponses ?? false;
  const successes = successResults(report);

  return {
    probeRuns: successes.map((result) => ({
      brand_id: report.brand.id,
      prompt_id: result.promptId,
      workflow_run_id: result.trace.workflowRunId,
      workflow_id: "WF-18",
      workflow_stage: "probe",
      engine: result.engine,
      raw_response: includeRawResponses ? result.run.rawResponse : null,
      normalized_answer: includeRawResponses ? result.run.normalizedAnswer : null,
      citations_json: result.run.extraction.brands_cited,
      mentions_json: result.run.extraction.brands_mentioned,
      claimed_urls_json: result.run.claimedUrls,
      off_site_sources_json: result.run.extraction.off_site_sources,
      sentiment: result.run.extraction.sentiment,
      cost_usd: result.run.costUsd,
      latency_ms: result.run.latencyMs,
      trace_metadata: result.trace,
    })),
    scores: successes.map((result) => ({
      brand_id: report.brand.id,
      prompt_id: result.promptId,
      workflow_id: "WF-18",
      engine: result.engine,
      brand_mentioned: result.score.brand_mentioned,
      brand_cited: result.score.brand_cited,
      brand_position: result.score.brand_position,
      recommendation_status: result.score.recommendation_status,
      competitor_mentions_json: result.score.competitor_mentions,
      competitor_citations_json: result.score.competitor_citations,
      citation_share: result.score.citation_share,
    })),
    snapshot: {
      brand_id: report.brand.id,
      workflow_id: "WF-18",
      generated_at: report.generatedAt,
      prompt_count: report.promptCount,
      provider_count: report.providerCount,
      total_run_count: report.totalRunCount,
      successful_run_count: report.successfulRunCount,
      failed_run_count: report.failedRunCount,
      brand_mention_rate: report.snapshot.brandMentionRate,
      brand_citation_rate: report.snapshot.brandCitationRate,
      average_citation_share: report.snapshot.averageCitationShare,
      volatility: report.snapshot.volatility,
      confidence: report.snapshot.confidence,
      snapshot_json: report.snapshot as unknown as Record<string, unknown>,
    },
    routes: report.routes.map((route) => ({
      brand_id: report.brand.id,
      workflow_id: route.workflowId,
      source_workflow_id: "WF-18",
      reason: route.reason,
      priority: route.priority,
      requires_hosted_execution: route.requiresHostedExecution,
      status: "queued",
    })),
  };
}

export async function persistCitationMonitoringReport(
  store: MonitoringStore,
  report: CitationMonitoringReport,
  options?: MonitoringPersistenceOptions,
): Promise<MonitoringPersistenceBatch> {
  const batch = buildMonitoringPersistenceBatch(report, options);
  await store.saveMonitoringReport(batch);
  return batch;
}
