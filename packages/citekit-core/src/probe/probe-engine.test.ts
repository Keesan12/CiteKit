import { describe, expect, it } from "vitest";
import { scoreExtraction } from "../score/score-engine";
import { generatePrompts } from "../prompts/generate-prompts";

describe("generatePrompts", () => {
  it("generates 25 prompts with competitive and pricing coverage", () => {
    const prompts = generatePrompts({
      name: "CiteOps",
      domain: "citeops.ai",
      category: "AI citation monitoring",
      targetPersona: "growth teams",
      competitors: [{ name: "Profound" }],
    });

    expect(prompts).toHaveLength(25);
    expect(prompts.some((prompt) => prompt.intent_type === "comparison")).toBe(true);
    expect(prompts.some((prompt) => prompt.intent_type === "pricing")).toBe(true);
  });
});

describe("scoreExtraction", () => {
  it("marks a cited brand as won when recommendation_winner matches", () => {
    const score = scoreExtraction(
      { name: "CiteOps", domain: "citeops.ai" },
      [{ name: "Profound", domain: "useprofound.com" }],
      {
        brands_mentioned: ["CiteOps", "Profound"],
        brands_cited: ["CiteOps"],
        cited_urls: ["https://citeops.ai/docs"],
        off_site_sources: ["reddit"],
        sentiment: "positive",
        recommendation_winner: "CiteOps",
        missing_brands: [],
      },
    );

    expect(score.recommendation_status).toBe("won");
    expect(score.brand_cited).toBe(true);
  });
});
