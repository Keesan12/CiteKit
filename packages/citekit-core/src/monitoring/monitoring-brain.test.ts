import { describe, expect, it } from "vitest";
import type { CitationExtraction } from "../schema/core";
import type { ProbeProvider, ProviderAnswer } from "../probe/types";
import { computeSovSnapshot, planMonitoringSchedule, runCitationMonitoring } from "./monitoring-brain";

function provider(
  extraction: CitationExtraction,
  rawResponse = "CiteOps is cited at https://citeops.ai",
): ProbeProvider {
  return {
    engine: "gpt4o",
    isConfigured: () => true,
    answer: async (): Promise<ProviderAnswer> => ({
      model: "test-model",
      rawResponse,
      normalizedAnswer: rawResponse,
      latencyMs: 25,
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
    extract: async () => extraction,
  };
}

function failingProvider(): ProbeProvider {
  return {
    engine: "claude",
    isConfigured: () => true,
    answer: async () => {
      throw new Error("provider offline");
    },
    extract: async () => ({
      brands_mentioned: [],
      brands_cited: [],
      cited_urls: [],
      off_site_sources: [],
      sentiment: "neutral",
      recommendation_winner: null,
      missing_brands: [],
    }),
  };
}

describe("runCitationMonitoring", () => {
  it("scores prompt-engine runs, computes SOV, routes gaps, and emits safe traces", async () => {
    const report = await runCitationMonitoring({
      now: new Date("2026-05-11T12:00:00.000Z"),
      brand: {
        id: "brand-1",
        name: "CiteOps",
        domain: "citeops.ai",
        category: "AI visibility",
        description: null,
        target_persona: "B2B operators",
      },
      competitors: [{ name: "Brand X", domain: "brandx.com" }],
      prompts: [
        {
          id: "prompt-1",
          prompt_text: "Best AI visibility monitor?",
          intent_type: "best_tool",
          buyer_stage: "awareness",
          priority: 10,
        },
      ],
      providers: [
        provider({
          brands_mentioned: ["CiteOps", "Brand X"],
          brands_cited: ["Brand X"],
          cited_urls: ["https://brandx.com"],
          off_site_sources: [],
          sentiment: "neutral",
          recommendation_winner: "Brand X",
          missing_brands: [],
        }),
      ],
    });

    expect(report.workflowId).toBe("WF-18");
    expect(report.successfulRunCount).toBe(1);
    expect(report.snapshot.brandMentionRate).toBe(1);
    expect(report.snapshot.brandCitationRate).toBe(0);
    expect(report.routes.map((route) => route.workflowId)).toEqual(["WF-01", "WF-02", "WF-07", "WF-19"]);
    expect(report.results[0]?.trace.inputHash).not.toContain("Best AI visibility monitor");
    expect(report.results[0]?.trace.workflowId).toBe("WF-18");
  });

  it("persists provider failures as failed monitoring results instead of aborting the report", async () => {
    const report = await runCitationMonitoring({
      brand: {
        id: "brand-1",
        name: "CiteOps",
        domain: "citeops.ai",
        category: null,
        description: null,
        target_persona: null,
      },
      prompts: [
        {
          prompt_text: "Best AI visibility monitor?",
          intent_type: "best_tool",
          buyer_stage: null,
          priority: 10,
        },
      ],
      providers: [failingProvider()],
    });

    expect(report.failedRunCount).toBe(1);
    expect(report.results[0]).toMatchObject({
      status: "failed",
      engine: "claude",
      errorMessage: "provider offline",
    });
    expect(report.routes[0]?.workflowId).toBe("WF-18");
  });
});

describe("computeSovSnapshot", () => {
  it("returns empty-safe aggregate values", () => {
    const snapshot = computeSovSnapshot([]);
    expect(snapshot.engine).toBe("all");
    expect(snapshot.successfulRunCount).toBe(0);
    expect(snapshot.confidence).toBe(0);
  });
});

describe("planMonitoringSchedule", () => {
  it("prioritizes high-priority prompts inside the requested panel size", () => {
    const schedule = planMonitoringSchedule({
      now: new Date("2026-05-11T00:00:00.000Z"),
      cadenceHours: 6,
      maxPrompts: 1,
      prompts: [
        { prompt_text: "low", intent_type: "best_tool", buyer_stage: null, priority: 2 },
        { prompt_text: "high priority prompt", intent_type: "comparison", buyer_stage: "decision", priority: 10 },
      ],
    });

    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.reason).toBe("high_priority");
    expect(schedule[0]?.dueAt).toBe("2026-05-11T06:00:00.000Z");
  });
});
