import { describe, expect, it } from "vitest";
import type { CitationExtraction } from "citekit-core";
import { renderDoctorReport, runDoctorCommand } from "./doctor";
import { renderMonitoringReport } from "./monitor";
import {
  normalizeCliDomain,
  parsePositiveIntegerOption,
  renderScanReport,
  renderScore,
  summarizeScan,
  toBrandSeed,
  toCliBrandInput,
} from "./shared";

describe("toBrandSeed", () => {
  it("normalizes competitor names into brand seed objects", () => {
    const seed = toBrandSeed({
      name: "CiteOps",
      domain: "citeops.ai",
      competitors: ["Brand X", "Brand Y"],
      persona: "operators",
    });

    expect(seed.competitors).toEqual([{ name: "Brand X" }, { name: "Brand Y" }]);
    expect(seed.targetPersona).toBe("operators");
  });
});

describe("normalizeCliDomain", () => {
  it("reduces a canonical site URL down to the host", () => {
    expect(normalizeCliDomain("https://www.citeops.ai/pricing?ref=test")).toBe("www.citeops.ai");
  });

  it("throws on empty domain input", () => {
    expect(() => normalizeCliDomain("   ")).toThrow("`--domain` must not be empty.");
  });
});

describe("parsePositiveIntegerOption", () => {
  it("accepts positive integers", () => {
    expect(parsePositiveIntegerOption("8", "--prompt-count", 5)).toBe(8);
  });

  it("rejects invalid counts with the option name in the error", () => {
    expect(() => parsePositiveIntegerOption("0", "--prompt-count", 5)).toThrow(
      "`--prompt-count` must be a positive integer.",
    );
  });
});

describe("toCliBrandInput", () => {
  it("normalizes domain input and de-duplicates competitors", () => {
    expect(
      toCliBrandInput({
        name: "CiteOps",
        domain: "https://citeops.ai/pricing",
        competitor: ["Profound", " Profound ", "Peec AI"],
        persona: "operators",
      }),
    ).toEqual({
      name: "CiteOps",
      domain: "citeops.ai",
      persona: "operators",
      competitors: ["Profound", "Peec AI"],
    });
  });
});

describe("renderScore", () => {
  it("marks the run as at risk when the brand is mentioned but not cited", () => {
    const extraction: CitationExtraction = {
      brands_mentioned: ["CiteOps", "Brand X"],
      brands_cited: ["Brand X"],
      cited_urls: ["https://brandx.com"],
      off_site_sources: [],
      sentiment: "neutral",
      recommendation_winner: "Brand X",
      missing_brands: [],
    };

    const score = renderScore(
      {
        name: "CiteOps",
        domain: "citeops.ai",
        competitors: ["Brand X"],
      },
      extraction,
    );

    expect(score.brand_mentioned).toBe(true);
    expect(score.brand_cited).toBe(false);
    expect(score.recommendation_status).toBe("at_risk");
  });
});

describe("summarizeScan", () => {
  it("builds a scan summary with the shape used by the landing page hero", () => {
    const summary = summarizeScan(
      {
        name: "CiteOps",
        domain: "citeops.ai",
        competitors: ["Brand X"],
      },
      [
        {
          prompt: {
            prompt_text: "best ai visibility platform",
            intent_type: "best_tool",
            buyer_stage: "awareness",
            priority: 10,
          },
          runs: [
            {
              engine: "gpt4o",
              model: "openrouter/test",
              rawResponse: "Brand X wins",
              normalizedAnswer: "Brand X wins",
              extraction: {
                brands_mentioned: ["CiteOps", "Brand X"],
                brands_cited: ["Brand X"],
                cited_urls: ["https://brandx.com"],
                off_site_sources: [],
                sentiment: "neutral",
                recommendation_winner: "Brand X",
                missing_brands: [],
              },
              claimedUrls: ["https://brandx.com"],
              costUsd: 0,
              latencyMs: 1200,
            },
          ],
          score: {
            brand_mentioned: true,
            brand_cited: false,
            brand_position: 2,
            recommendation_status: "at_risk",
            competitor_mentions: ["Brand X"],
            competitor_citations: ["Brand X"],
            citation_share: 0,
          },
          diagnoses: [
            {
              issue_type: "no_comparison",
              severity: 8,
              explanation: "No comparison surface exists.",
              competitor_advantage: "Brand X has a comparison page.",
              recommended_fix_type: "comparison_page",
            },
          ],
        },
      ],
      [
        {
          fix_type: "comparison_page",
          title: "Publish comparison page vs Brand X",
          draft_content: "Build a proof-backed comparison page.",
        },
      ],
    );

    expect(summary.command).toContain("citekit scan");
    expect(summary.engineCount).toBe(1);
    expect(summary.recommendedFixes).toContain("Publish comparison page vs Brand X");
    expect(renderScanReport(summary)).toContain("AI Visibility Score");
  });
});

describe("renderMonitoringReport", () => {
  it("renders confidence-aware WF-18 output", () => {
    const rendered = renderMonitoringReport({
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
        brandCitationRate: 0.5,
        averageCitationShare: 0.5,
        volatility: 0.25,
        confidence: 0.75,
        statusCounts: { won: 0, visible: 1, at_risk: 0, lost: 0, wrong: 0, unanswerable: 0 },
        competitorCitationCounts: {},
        winners: {},
      },
      results: [],
      routes: [
        {
          workflowId: "WF-01",
          reason: "Check llms.txt.",
          priority: 90,
          requiresHostedExecution: false,
        },
      ],
      traces: [],
    });

    expect(rendered).toContain("WF-18 Monitor");
    expect(rendered).toContain("Confidence: 75%");
    expect(rendered).toContain("WF-01");
  });
});

describe("renderDoctorReport", () => {
  it("groups integration readiness by status without printing secrets", () => {
    const rendered = renderDoctorReport({
      status: "invalid",
      integrations: {
        supabase: {
          integration: "supabase",
          status: "missing",
          summary: "Supabase is missing credentials.",
          blockers: ["Missing SUPABASE_URL."],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        github: {
          integration: "github",
          status: "ready",
          summary: "GitHub passed a probe.",
          blockers: [],
          verificationHints: [],
          credentials: [{ field: "GITHUB_TOKEN", source: "env", present: true, maskedValue: "[masked:abc123]" }],
          metadata: {},
          probeAttempted: true,
          probeEvidence: [
            {
              kind: "http",
              label: "GitHub live probe",
              result: "pass",
              detail: "GET https://api.github.com/user -> HTTP 200",
              target: "https://api.github.com/user",
              statusCode: 200,
            },
          ],
        },
        stripe: {
          integration: "stripe",
          status: "invalid",
          summary: "Stripe key is malformed.",
          blockers: ["STRIPE_SECRET_KEY must be a Stripe secret or restricted key."],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        webflow: {
          integration: "webflow",
          status: "unverified",
          summary: "Webflow credentials are present.",
          blockers: ["Webflow credentials have not been live-verified by a caller-supplied probe."],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        wordpress: {
          integration: "wordpress",
          status: "missing",
          summary: "WordPress is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        sentry: {
          integration: "sentry",
          status: "missing",
          summary: "Sentry is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        posthog: {
          integration: "posthog",
          status: "missing",
          summary: "PostHog is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        openai: {
          integration: "openai",
          status: "missing",
          summary: "OpenAI is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        anthropic: {
          integration: "anthropic",
          status: "missing",
          summary: "Anthropic is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        google: {
          integration: "google",
          status: "missing",
          summary: "Google is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        perplexity: {
          integration: "perplexity",
          status: "missing",
          summary: "Perplexity is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
        openrouter: {
          integration: "openrouter",
          status: "missing",
          summary: "OpenRouter is missing credentials.",
          blockers: [],
          verificationHints: [],
          credentials: [],
          metadata: {},
          probeAttempted: false,
          probeEvidence: [],
        },
      },
    });

    expect(rendered).toContain("Overall status: INVALID");
    expect(rendered).toContain("github: GitHub passed a probe.");
    expect(rendered).toContain("[probe: GET https://api.github.com/user -> HTTP 200]");
    expect(rendered).not.toContain("[masked:abc123]");
  });

  it("passes opt-in live probe runners into the doctor command", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => '{"object":"list","data":[]}',
    });

    const report = await runDoctorCommand(
      {
        OPENAI_API_KEY: "sk-live-openai-key",
      },
      {
        live: true,
        probeOptions: {
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      },
    );

    expect(report.integrations.openai.status).toBe("ready");
    expect(report.integrations.openai.probeAttempted).toBe(true);
    expect(report.integrations.openai.probeEvidence[0]?.detail).toBe("GET https://api.openai.com/v1/models -> HTTP 200");
  });
});
