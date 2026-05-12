import { type CitationExtraction } from "../../schema/core";
import { fallbackExtraction, parseJsonExtraction } from "./base";
import { normalizeWhitespace } from "../../utils/text";
import type { ProbeExecutionContext, ProbeProvider, ProviderAnswer } from "../types";

interface PerplexityResponse {
  model: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class PerplexityProbeProvider implements ProbeProvider {
  public readonly engine = "perplexity" as const;
  private readonly apiKey: string | null;
  private readonly model: string;

  constructor(apiKey: string | undefined, model: string) {
    this.apiKey = apiKey ?? null;
    this.model = model;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async answer(prompt: string, context: ProbeExecutionContext): Promise<ProviderAnswer> {
    if (!this.apiKey) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are a buyer-side research assistant. Answer directly, cite URLs when possible, and state a recommendation when one is warranted.",
          },
          {
            role: "user",
            content: `${prompt}\n\nBrand context: ${context.brand.name} (${context.brand.domain})`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity probe request failed: ${response.status}`);
    }

    const payload = (await response.json()) as PerplexityResponse;
    const rawResponse = payload.choices[0]?.message.content ?? "";
    return {
      model: payload.model,
      rawResponse,
      normalizedAnswer: normalizeWhitespace(rawResponse),
      latencyMs: Date.now() - startedAt,
      usage: {
        ...(payload.usage?.prompt_tokens !== undefined ? { inputTokens: payload.usage.prompt_tokens } : {}),
        ...(payload.usage?.completion_tokens !== undefined ? { outputTokens: payload.usage.completion_tokens } : {}),
      },
    };
  }

  async extract(rawAnswer: string, context: ProbeExecutionContext): Promise<CitationExtraction> {
    if (!this.apiKey) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "Return JSON only. Extract citation data with keys brands_mentioned, brands_cited, cited_urls, off_site_sources, sentiment, recommendation_winner, missing_brands.",
          },
          {
            role: "user",
            content: `Brand: ${context.brand.name}\nBrand domain: ${context.brand.domain}\nTracked competitors: ${(context.competitors ?? []).map((item) => item.name).join(", ") || "none"}\nAnswer:\n${rawAnswer}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return fallbackExtraction(rawAnswer, context);
    }

    const payload = (await response.json()) as PerplexityResponse;
    return parseJsonExtraction(payload.choices[0]?.message.content ?? "") ?? fallbackExtraction(rawAnswer, context);
  }
}
