import type { ProbeEngineName, RecommendationStatus, WorkflowId } from "../db/types";
import { runProbe } from "../probe/probe-engine";
import type { ProbeExecutionContext } from "../probe/types";
import { scoreExtraction } from "../score/score-engine";
import { buildTracePayload } from "../trace/types";
import { sha256 } from "../utils/hash";
import type {
  CitationMonitoringFailure,
  CitationMonitoringReport,
  CitationMonitoringResult,
  CitationMonitoringSuccess,
  EngineSovSnapshot,
  MonitoringPrompt,
  MonitoringRunInput,
  MonitoringScheduleInput,
  MonitoringSovSnapshot,
  RoutedWorkflow,
  ScheduledMonitoringPrompt,
} from "./types";

const STATUS_VALUES: RecommendationStatus[] = ["won", "visible", "at_risk", "lost", "wrong", "unanswerable"];

function toError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: "Error", message: typeof error === "string" ? error : "Unknown monitoring failure" };
}

function promptId(prompt: MonitoringPrompt, index: number): string {
  return prompt.id ?? `prompt-${index + 1}-${sha256(prompt.prompt_text).slice(0, 12)}`;
}

function emptyStatusCounts(): Record<RecommendationStatus, number> {
  return {
    won: 0,
    visible: 0,
    at_risk: 0,
    lost: 0,
    wrong: 0,
    unanswerable: 0,
  };
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function uniqueRoutes(routes: RoutedWorkflow[]): RoutedWorkflow[] {
  const byWorkflow = new Map<WorkflowId, RoutedWorkflow>();

  for (const route of routes) {
    const current = byWorkflow.get(route.workflowId);
    if (!current || route.priority > current.priority) {
      byWorkflow.set(route.workflowId, route);
    }
  }

  return Array.from(byWorkflow.values()).sort((left, right) => right.priority - left.priority);
}

export function routeCitationGap(
  result: Pick<CitationMonitoringSuccess, "score" | "run" | "intentType">,
): RoutedWorkflow[] {
  const routes: RoutedWorkflow[] = [];
  const { score, run, intentType } = result;

  if (!score.brand_mentioned || score.recommendation_status === "wrong" || score.recommendation_status === "unanswerable") {
    routes.push({
      workflowId: "WF-05",
      reason: "Brand is missing or poorly framed in the answer; prioritize answer-first content.",
      priority: 90,
      requiresHostedExecution: false,
    });
  }

  if (!score.brand_cited) {
    routes.push({
      workflowId: "WF-01",
      reason: "Brand was not cited; check llms.txt and canonical citation guidance.",
      priority: 84,
      requiresHostedExecution: false,
    });
    routes.push({
      workflowId: "WF-02",
      reason: "Brand was not cited; verify AI crawler access and fetchability.",
      priority: 80,
      requiresHostedExecution: false,
    });
  }

  if (score.competitor_citations.length > 0 || score.recommendation_status === "lost") {
    routes.push({
      workflowId: "WF-07",
      reason: "Competitors are cited or winning; create human-approved comparison surfaces.",
      priority: 78,
      requiresHostedExecution: true,
    });
  }

  if (intentType === "pricing") {
    routes.push({
      workflowId: "WF-08",
      reason: "Pricing prompts depend on freshness signals and clear update dates.",
      priority: 66,
      requiresHostedExecution: false,
    });
  }

  if (run.extraction.off_site_sources.length === 0 && score.recommendation_status !== "won") {
    routes.push({
      workflowId: "WF-19",
      reason: "Answer lacks third-party/off-site proof; diversify citation surfaces.",
      priority: 62,
      requiresHostedExecution: true,
    });
  }

  return uniqueRoutes(routes);
}

export function routeMonitoringFailure(engine: ProbeEngineName, message: string): RoutedWorkflow[] {
  return [
    {
      workflowId: "WF-18",
      reason: `Monitoring probe failed on ${engine}: ${message}`,
      priority: 100,
      requiresHostedExecution: true,
    },
  ];
}

function buildEngineSnapshot(engine: ProbeEngineName, results: CitationMonitoringResult[]): EngineSovSnapshot {
  const engineResults = results.filter((result) => result.engine === engine);
  const successes = engineResults.filter((result): result is CitationMonitoringSuccess => result.status === "success");
  const failures = engineResults.filter((result): result is CitationMonitoringFailure => result.status === "failed");
  const statusCounts = emptyStatusCounts();
  const competitorCitationCounts: Record<string, number> = {};
  const winners: Record<string, number> = {};

  for (const result of successes) {
    statusCounts[result.score.recommendation_status] += 1;
    for (const competitor of result.score.competitor_citations) {
      competitorCitationCounts[competitor] = (competitorCitationCounts[competitor] ?? 0) + 1;
    }
    const winner = result.run.extraction.recommendation_winner;
    if (winner) {
      winners[winner] = (winners[winner] ?? 0) + 1;
    }
  }

  const denominator = Math.max(successes.length, 1);
  const brandMentionRate = successes.filter((result) => result.score.brand_mentioned).length / denominator;
  const brandCitationRate = successes.filter((result) => result.score.brand_cited).length / denominator;
  const averageCitationShare =
    successes.reduce((sum, result) => sum + result.score.citation_share, 0) / denominator;
  const volatility = successes.length === 0
    ? 1
    : successes.filter((result) => result.score.recommendation_status !== "won" && result.score.recommendation_status !== "visible")
        .length / denominator;
  const confidence = Math.max(0, Math.min(1, successes.length / Math.max(engineResults.length, 1) - volatility * 0.25));

  return {
    engine,
    promptCount: new Set(engineResults.map((result) => result.promptId)).size,
    successfulRunCount: successes.length,
    failedRunCount: failures.length,
    brandMentionRate: round4(brandMentionRate),
    brandCitationRate: round4(brandCitationRate),
    averageCitationShare: round4(averageCitationShare),
    volatility: round4(volatility),
    confidence: round4(confidence),
    statusCounts,
    competitorCitationCounts,
    winners,
  };
}

export function computeSovSnapshot(results: CitationMonitoringResult[]): MonitoringSovSnapshot {
  const engines = Array.from(new Set(results.map((result) => result.engine))).sort();
  const engineSnapshots = engines.map((engine) => buildEngineSnapshot(engine, results));
  const allStatuses = emptyStatusCounts();
  const competitorCitationCounts: Record<string, number> = {};
  const winners: Record<string, number> = {};

  for (const snapshot of engineSnapshots) {
    for (const status of STATUS_VALUES) {
      allStatuses[status] += snapshot.statusCounts[status];
    }
    for (const [competitor, count] of Object.entries(snapshot.competitorCitationCounts)) {
      competitorCitationCounts[competitor] = (competitorCitationCounts[competitor] ?? 0) + count;
    }
    for (const [winner, count] of Object.entries(snapshot.winners)) {
      winners[winner] = (winners[winner] ?? 0) + count;
    }
  }

  const successfulRunCount = engineSnapshots.reduce((sum, snapshot) => sum + snapshot.successfulRunCount, 0);
  const failedRunCount = engineSnapshots.reduce((sum, snapshot) => sum + snapshot.failedRunCount, 0);
  const denominator = Math.max(successfulRunCount, 1);
  const weighted = (key: "brandMentionRate" | "brandCitationRate" | "averageCitationShare" | "volatility" | "confidence") =>
    engineSnapshots.reduce((sum, snapshot) => sum + snapshot[key] * snapshot.successfulRunCount, 0) / denominator;

  return {
    engine: "all",
    engines: engineSnapshots,
    promptCount: new Set(results.map((result) => result.promptId)).size,
    successfulRunCount,
    failedRunCount,
    brandMentionRate: round4(weighted("brandMentionRate")),
    brandCitationRate: round4(weighted("brandCitationRate")),
    averageCitationShare: round4(weighted("averageCitationShare")),
    volatility: round4(weighted("volatility")),
    confidence: round4(weighted("confidence")),
    statusCounts: allStatuses,
    competitorCitationCounts,
    winners,
  };
}

export function planMonitoringSchedule(input: MonitoringScheduleInput): ScheduledMonitoringPrompt[] {
  const now = input.now ?? new Date();
  const maxPrompts = input.maxPrompts ?? input.prompts.length;
  const cadenceHours = input.cadenceHours ?? 24;
  const dueAt = new Date(now.getTime() + cadenceHours * 60 * 60 * 1000).toISOString();

  return [...input.prompts]
    .sort((left, right) => right.priority - left.priority || left.prompt_text.localeCompare(right.prompt_text))
    .slice(0, maxPrompts)
    .map((prompt) => ({
      prompt,
      dueAt,
      reason: prompt.priority >= 9 ? "high_priority" : "stale",
    }));
}

export async function runCitationMonitoring(input: MonitoringRunInput): Promise<CitationMonitoringReport> {
  if (input.prompts.length === 0) {
    throw new Error("Citation monitoring requires at least one prompt.");
  }
  if (input.providers.length === 0) {
    throw new Error("Citation monitoring requires at least one provider.");
  }

  const generatedAt = (input.now ?? new Date()).toISOString();
  const results: CitationMonitoringResult[] = [];

  for (const [index, prompt] of input.prompts.entries()) {
    const id = promptId(prompt, index);
    const context: ProbeExecutionContext = {
      brand: input.brand,
      prompt: {
        id,
        prompt_text: prompt.prompt_text,
        intent_type: prompt.intent_type,
      },
      competitors: input.competitors ?? [],
      trace: {
        workflowRunId: input.workflowRunId ?? null,
        workflowId: "WF-18",
        workflowStage: "probe",
      },
    };

    for (const provider of input.providers) {
      try {
        const run = await runProbe(provider, context);
        const score = scoreExtraction(input.brand, input.competitors ?? [], run.extraction);
        const routedWorkflows = routeCitationGap({ score, run, intentType: prompt.intent_type });
        const trace = buildTracePayload({
          agentName: `${provider.engine}-wf18-monitor`,
          brandId: input.brand.id,
          workflowRunId: input.workflowRunId ?? null,
          workflowId: "WF-18",
          workflowStage: "probe",
          actionType: "citation_monitor.probe",
          inputHash: sha256(prompt.prompt_text),
          outputHash: sha256(run.rawResponse),
          costUsd: run.costUsd,
          latencyMs: run.latencyMs,
          success: true,
          sansaUsed: false,
          metadata: {
            promptId: id,
            intentType: prompt.intent_type,
            routedWorkflowIds: routedWorkflows.map((route) => route.workflowId),
          },
        });

        results.push({
          status: "success",
          promptId: id,
          promptText: prompt.prompt_text,
          intentType: prompt.intent_type,
          engine: provider.engine,
          model: run.model,
          run,
          score,
          routedWorkflows,
          trace,
        });
      } catch (error) {
        const normalized = toError(error);
        const routedWorkflows = routeMonitoringFailure(provider.engine, normalized.message);
        const trace = buildTracePayload({
          agentName: `${provider.engine}-wf18-monitor`,
          brandId: input.brand.id,
          workflowRunId: input.workflowRunId ?? null,
          workflowId: "WF-18",
          workflowStage: "probe",
          actionType: "citation_monitor.probe",
          inputHash: sha256(prompt.prompt_text),
          outputHash: null,
          costUsd: 0,
          latencyMs: null,
          success: false,
          errorMessage: normalized.message,
          sansaUsed: false,
          metadata: { promptId: id, intentType: prompt.intent_type },
        });

        results.push({
          status: "failed",
          promptId: id,
          promptText: prompt.prompt_text,
          intentType: prompt.intent_type,
          engine: provider.engine,
          errorName: normalized.name,
          errorMessage: normalized.message,
          routedWorkflows,
          trace,
        });
      }
    }
  }

  const snapshot = computeSovSnapshot(results);
  const routes = uniqueRoutes(results.flatMap((result) => result.routedWorkflows));

  return {
    workflowId: "WF-18",
    generatedAt,
    brand: input.brand,
    promptCount: input.prompts.length,
    providerCount: input.providers.length,
    totalRunCount: results.length,
    successfulRunCount: snapshot.successfulRunCount,
    failedRunCount: snapshot.failedRunCount,
    snapshot,
    results,
    routes,
    traces: results.map((result) => result.trace),
  };
}
