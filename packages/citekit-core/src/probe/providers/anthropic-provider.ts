import Anthropic from "@anthropic-ai/sdk";
import type { CitationExtraction } from "../../schema/core";
import { parseJsonExtraction, fallbackExtraction } from "./base";
import { normalizeWhitespace } from "../../utils/text";
import type { ProbeExecutionContext, ProbeProvider, ProviderAnswer } from "../types";

export class AnthropicProbeProvider implements ProbeProvider {
  public readonly engine = "claude" as const;
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(apiKey: string | undefined, model: string) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = model;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async answer(prompt: string, context: ProbeExecutionContext): Promise<ProviderAnswer> {
    if (!this.client) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 900,
      system:
        "You are a buyer-side research assistant. Answer directly, cite URLs when possible, and state a recommendation when one is warranted.",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nBrand context: ${context.brand.name} (${context.brand.domain})`,
        },
      ],
    });

    const rawResponse = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      model: this.model,
      rawResponse,
      normalizedAnswer: normalizeWhitespace(rawResponse),
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async extract(rawAnswer: string, context: ProbeExecutionContext): Promise<CitationExtraction> {
    if (!this.client) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 700,
      system:
        "Return JSON only. The JSON must match the requested citation schema exactly. If a field is unknown, return an empty array or null as appropriate.",
      messages: [
        {
          role: "user",
          content: `Extract citation data.\nBrand: ${context.brand.name}\nBrand domain: ${context.brand.domain}\nTracked competitors: ${(context.competitors ?? []).map((item) => item.name).join(", ") || "none"}\nAnswer:\n${rawAnswer}\n\nReturn JSON with keys brands_mentioned, brands_cited, cited_urls, off_site_sources, sentiment, recommendation_winner, missing_brands.`,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return parseJsonExtraction(text) ?? fallbackExtraction(rawAnswer, context);
  }
}
