import { describe, expect, it } from "vitest";
import { readProviderEnv } from "./provider-env";

describe("provider env", () => {
  it("provides OpenRouter defaults without requiring separate engine keys", () => {
    const env = readProviderEnv({ OPENROUTER_API_KEY: "test-key" });

    expect(env.OPENROUTER_API_KEY).toBe("test-key");
    expect(env.OPENROUTER_PROBE_MODEL).toBe("openai/gpt-4.1-mini");
    expect(env.OPENROUTER_ANTHROPIC_MODEL).toBe("anthropic/claude-sonnet-4");
    expect(env.OPENROUTER_GOOGLE_MODEL).toBe("google/gemini-2.0-flash-001");
    expect(env.OPENROUTER_PERPLEXITY_MODEL).toBe("perplexity/sonar");
  });
});
