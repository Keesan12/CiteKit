import { describe, expect, it } from "vitest";
import { createProbeProviders } from "./provider-registry";

describe("probe provider registry", () => {
  it("creates all engine providers from a single OpenRouter key when direct keys are absent", () => {
    const providers = createProbeProviders({
      OPENROUTER_API_KEY: "test-key",
    });

    expect(providers.map((provider) => provider.engine)).toEqual(["gpt4o", "claude", "gemini", "perplexity"]);
  });
});
