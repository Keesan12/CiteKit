import { z } from "zod";

export const ProviderEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_PROBE_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_EXTRACTION_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_PROBE_MODEL: z.string().min(1).default("openai/gpt-4.1-mini"),
  OPENROUTER_EXTRACTION_MODEL: z.string().min(1).default("openai/gpt-4.1-mini"),
  OPENROUTER_ANTHROPIC_MODEL: z.string().min(1).default("anthropic/claude-sonnet-4"),
  OPENROUTER_GOOGLE_MODEL: z.string().min(1).default("google/gemini-2.0-flash-001"),
  OPENROUTER_PERPLEXITY_MODEL: z.string().min(1).default("perplexity/sonar"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_PROBE_MODEL: z.string().min(1).default("claude-sonnet-4-20250514"),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  GOOGLE_PROBE_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  PERPLEXITY_API_KEY: z.string().min(1).optional(),
  PERPLEXITY_PROBE_MODEL: z.string().min(1).default("sonar"),
});

export type ProviderEnv = z.infer<typeof ProviderEnvSchema>;

export function readProviderEnv(source: NodeJS.ProcessEnv = process.env): ProviderEnv {
  return ProviderEnvSchema.parse(source);
}
