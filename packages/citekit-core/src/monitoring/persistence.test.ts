import { describe, expect, it } from "vitest";
import type { CitationMonitoringReport } from "./types";
import { buildMonitoringPersistenceBatch, persistCitationMonitoringReport, type MonitoringStore } from "./persistence";

const report: CitationMonitoringReport = {
  workflowId: "WF-18",
  generatedAt: "2026-05-11T00:00:00.000Z",
  brand: {
    id: "brand-1",
    name: "CiteOps",
    domain: "citeops.ai",
    category: null,
    description: null,
    target_persona: null,
  },
  promptCount: 1,
  providerCount: 1,
  totalRunCount: 1,
  successfulRunCount: 1,
  failedRunCount: 0,
  snapshot: {
    engine: "all",
    engines: [],
    promptCount: 1,
    successfulRunCount: 1,
    failedRunCount: 0,
    brandMentionRate: 1,
    brandCitationRate: 1,
    averageCitationShare: 1,
    volatility: 0,
    confidence: 1,
    statusCounts: { won: 1, visible: 0, at_risk: 0, lost: 0, wrong: 0, unanswerable: 0 },
    competitorCitationCounts: {},
    winners: { CiteOps: 1 },
  },
  results: [
    {
      status: "success",
      promptId: "prompt-1",
      promptText: "Best AI visibility monitor?",
      intentType: "best_tool",
      engine: "gpt4o",
      model: "test",
      run: {
        engine: "gpt4o",
        model: "test",
        rawResponse: "raw answer with customer-sensitive wording",
        normalizedAnswer: "normalized answer",
        extraction: {
          brands_mentioned: ["CiteOps"],
          brands_cited: ["CiteOps"],
          cited_urls: ["https://citeops.ai"],
          off_site_sources: [],
          sentiment: "positive",
          recommendation_winner: "CiteOps",
          missing_brands: [],
        },
        claimedUrls: ["https://citeops.ai"],
        costUsd: 0.001,
        latencyMs: 10,
      },
      score: {
        brand_mentioned: true,
        brand_cited: true,
        brand_position: 1,
        recommendation_status: "won",
        competitor_mentions: [],
        competitor_citations: [],
        citation_share: 1,
      },
      routedWorkflows: [],
      trace: {
        agentName: "gpt4o-wf18-monitor",
        brandId: "brand-1",
        workflowRunId: null,
        workflowId: "WF-18",
        workflowStage: "probe",
        actionType: "citation_monitor.probe",
        inputHash: "input-hash",
        outputHash: "output-hash",
        costUsd: 0.001,
        latencyMs: 10,
        success: true,
        errorMessage: null,
        sansaUsed: false,
        metadata: {},
      },
    },
  ],
  routes: [
    {
      workflowId: "WF-01",
      reason: "Improve llms.txt.",
      priority: 80,
      requiresHostedExecution: false,
    },
  ],
  traces: [],
};

describe("buildMonitoringPersistenceBatch", () => {
  it("omits raw responses by default for public-safe persistence batches", () => {
    const batch = buildMonitoringPersistenceBatch(report);
    expect(batch.probeRuns[0]?.raw_response).toBeNull();
    expect(batch.probeRuns[0]?.normalized_answer).toBeNull();
    expect(JSON.stringify(batch)).not.toContain("customer-sensitive wording");
    expect(batch.snapshot.confidence).toBe(1);
    expect(batch.routes[0]?.workflow_id).toBe("WF-01");
  });

  it("can include raw responses only when explicitly requested", () => {
    const batch = buildMonitoringPersistenceBatch(report, { includeRawResponses: true });
    expect(batch.probeRuns[0]?.raw_response).toContain("customer-sensitive wording");
  });
});

describe("persistCitationMonitoringReport", () => {
  it("hands the deterministic batch to a real store interface", async () => {
    const saved: unknown[] = [];
    const store: MonitoringStore = {
      saveMonitoringReport: async (batch) => {
        saved.push(batch);
      },
    };

    const batch = await persistCitationMonitoringReport(store, report);
    expect(saved).toEqual([batch]);
  });
});
