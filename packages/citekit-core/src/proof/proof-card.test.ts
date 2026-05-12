import { describe, expect, it } from "vitest";
import { sha256 } from "../utils/hash";
import { buildPublicProofCard } from "./proof-card";

describe("proof card generation", () => {
  it("builds a public-safe proof card with hashed prompt and fix identities", () => {
    const card = buildPublicProofCard({
      experimentId: "exp_123",
      workflowRunId: "run_123",
      workflowId: "WF-04",
      generatedAt: "2026-05-11T12:00:00.000Z",
      attributionConfidence: 0.8,
      predictedLift: 0.22,
      fix: {
        fixId: "fix_123",
        fixType: "docs_update",
        status: "deployed",
        title: "Docs authority update",
        draftContent: "Confidential draft content that must never leave the safe payload.",
      },
      promptExperiments: [
        {
          promptId: "prompt_1",
          promptText: "best b2b docs software",
          intent: "best_tool",
          engine: "gpt4o",
          beforeCitationShare: 0.2,
          afterCitationShare: 0.6,
          beforeRecommendationStatus: "at_risk",
          afterRecommendationStatus: "visible",
        },
        {
          promptId: "prompt_2",
          promptText: "docs software with security faq",
          intent: "compliance",
          engine: "claude",
          beforeCitationShare: 0.1,
          afterCitationShare: 0.3,
          beforeRecommendationStatus: "lost",
          afterRecommendationStatus: "visible",
        },
      ],
    });

    expect(card.result).toBe("improved");
    expect(card.deltas.citationShare).toBe(0.3);
    expect(card.engines).toEqual(["gpt4o", "claude"]);
    expect(card.fix.contentHash).toBe(
      sha256("Confidential draft content that must never leave the safe payload."),
    );
    expect(JSON.stringify(card)).not.toContain("Confidential draft content");
    expect(card.affectedPrompts[0]?.promptHash).toBe(sha256("best b2b docs software"));
    expect(card.sansaObservation.promptHashes).toEqual([
      sha256("best b2b docs software"),
      sha256("docs software with security faq"),
    ]);
  });

  it("uses provided hashes and classifies flat results", () => {
    const card = buildPublicProofCard({
      experimentId: "exp_456",
      generatedAt: "2026-05-11T12:00:00.000Z",
      fix: {
        fixId: "fix_456",
        fixType: "schema",
        status: "approved",
        contentHash: "a".repeat(64),
      },
      promptExperiments: [
        {
          promptId: "prompt_1",
          promptHash: "b".repeat(64),
          engine: "gpt4o",
          beforeCitationShare: 0.4,
          afterCitationShare: 0.4,
        },
      ],
    });

    expect(card.result).toBe("flat");
    expect(card.fix.contentHash).toBe("a".repeat(64));
    expect(card.affectedPrompts[0]?.promptHash).toBe("b".repeat(64));
    expect(card.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(card.confidence.overall).toBeLessThanOrEqual(1);
  });

  it("fails fast on duplicate prompt and engine combinations", () => {
    expect(() =>
      buildPublicProofCard({
        experimentId: "exp_789",
        generatedAt: "2026-05-11T12:00:00.000Z",
        fix: {
          fixId: "fix_789",
          fixType: "faq",
          status: "draft",
          draftContent: "draft",
        },
        promptExperiments: [
          {
            promptId: "prompt_1",
            promptText: "prompt one",
            engine: "gpt4o",
            beforeCitationShare: 0.1,
            afterCitationShare: 0.2,
          },
          {
            promptId: "prompt_1",
            promptText: "prompt two",
            engine: "gpt4o",
            beforeCitationShare: 0.2,
            afterCitationShare: 0.3,
          },
        ],
      }),
    ).toThrow(/Each prompt\/engine pair must be unique/);
  });
});
