import { readProviderEnv } from "../config/provider-env";
import { AnthropicProbeProvider } from "./providers/anthropic-provider";
import { GoogleProbeProvider } from "./providers/google-provider";
import { OpenAIProbeProvider } from "./providers/openai-provider";
import { OpenRouterProbeProvider } from "./providers/openrouter-provider";
import { PerplexityProbeProvider } from "./providers/perplexity-provider";
import type { ProbeProvider } from "./types";

export function createProbeProviders(source: NodeJS.ProcessEnv = process.env): ProbeProvider[] {
  const env = readProviderEnv(source);
  const providers: ProbeProvider[] = [];

  providers.push(
    env.OPENAI_API_KEY
      ? new OpenAIProbeProvider(env.OPENAI_API_KEY, env.OPENAI_PROBE_MODEL, env.OPENAI_EXTRACTION_MODEL)
      : new OpenRouterProbeProvider("gpt4o", env.OPENROUTER_API_KEY, env.OPENROUTER_PROBE_MODEL, env.OPENROUTER_EXTRACTION_MODEL),
  );

  providers.push(
    env.ANTHROPIC_API_KEY
      ? new AnthropicProbeProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_PROBE_MODEL)
      : new OpenRouterProbeProvider("claude", env.OPENROUTER_API_KEY, env.OPENROUTER_ANTHROPIC_MODEL, env.OPENROUTER_EXTRACTION_MODEL),
  );

  providers.push(
    env.GOOGLE_API_KEY
      ? new GoogleProbeProvider(env.GOOGLE_API_KEY, env.GOOGLE_PROBE_MODEL)
      : new OpenRouterProbeProvider("gemini", env.OPENROUTER_API_KEY, env.OPENROUTER_GOOGLE_MODEL, env.OPENROUTER_EXTRACTION_MODEL),
  );

  providers.push(
    env.PERPLEXITY_API_KEY
      ? new PerplexityProbeProvider(env.PERPLEXITY_API_KEY, env.PERPLEXITY_PROBE_MODEL)
      : new OpenRouterProbeProvider("perplexity", env.OPENROUTER_API_KEY, env.OPENROUTER_PERPLEXITY_MODEL, env.OPENROUTER_EXTRACTION_MODEL),
  );

  return providers.filter((provider) => provider.isConfigured());
}
