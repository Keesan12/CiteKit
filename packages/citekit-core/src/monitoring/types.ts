import type { BrandRecord, CompetitorRecord, ProbeEngineName, PromptIntent, WorkflowId } from "../db/types";
import type { ProbeProvider, ProbeRunResult } from "../probe/types";
import type { PromptDraft, VisibilityScore } from "../schema/core";
import type { MartinLoopTracePayload } from "../trace/types";

export type MonitoringResultStatus = "success" | "failed";

export interface MonitoringPrompt extends PromptDraft {
  id?: string;
  panel?: string | null;
}

export type MonitoringBrand = Pick<BrandRecord, "id" | "name" | "domain" | "category" | "description" | "target_persona">;

export type MonitoringCompetitor = Pick<CompetitorRecord, "name" | "domain">;

export interface MonitoringRunInput {
  brand: MonitoringBrand;
  prompts: MonitoringPrompt[];
  providers: ProbeProvider[];
  competitors?: MonitoringCompetitor[];
  workflowRunId?: string | null;
  now?: Date;
}

export interface CitationMonitoringSuccess {
  status: "success";
  promptId: string;
  promptText: string;
  intentType: PromptIntent;
  engine: ProbeEngineName;
  model: string;
  run: ProbeRunResult;
  score: VisibilityScore;
  routedWorkflows: RoutedWorkflow[];
  trace: Required<MartinLoopTracePayload>;
}

export interface CitationMonitoringFailure {
  status: "failed";
  promptId: string;
  promptText: string;
  intentType: PromptIntent;
  engine: ProbeEngineName;
  errorName: string;
  errorMessage: string;
  routedWorkflows: RoutedWorkflow[];
  trace: Required<MartinLoopTracePayload>;
}

export type CitationMonitoringResult = CitationMonitoringSuccess | CitationMonitoringFailure;

export interface RoutedWorkflow {
  workflowId: WorkflowId;
  reason: string;
  priority: number;
  requiresHostedExecution: boolean;
}

export interface EngineSovSnapshot {
  engine: ProbeEngineName;
  promptCount: number;
  successfulRunCount: number;
  failedRunCount: number;
  brandMentionRate: number;
  brandCitationRate: number;
  averageCitationShare: number;
  volatility: number;
  confidence: number;
  statusCounts: Record<VisibilityScore["recommendation_status"], number>;
  competitorCitationCounts: Record<string, number>;
  winners: Record<string, number>;
}

export interface MonitoringSovSnapshot extends Omit<EngineSovSnapshot, "engine"> {
  engine: "all";
  engines: EngineSovSnapshot[];
}

export interface CitationMonitoringReport {
  workflowId: "WF-18";
  generatedAt: string;
  brand: MonitoringBrand;
  promptCount: number;
  providerCount: number;
  totalRunCount: number;
  successfulRunCount: number;
  failedRunCount: number;
  snapshot: MonitoringSovSnapshot;
  results: CitationMonitoringResult[];
  routes: RoutedWorkflow[];
  traces: Required<MartinLoopTracePayload>[];
}

export interface MonitoringScheduleInput {
  prompts: MonitoringPrompt[];
  now?: Date;
  cadenceHours?: number;
  maxPrompts?: number;
}

export interface ScheduledMonitoringPrompt {
  prompt: MonitoringPrompt;
  dueAt: string;
  reason: "new" | "stale" | "high_priority";
}
