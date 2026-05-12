import OpenAI from "openai";
import { CitationExtractionSchema, type CitationExtraction } from "../../schema/core";
import { normalizeWhitespace } from "../../utils/text";
import { fallbackExtraction, parseJsonExtraction } from "./base";
import type { ProbeExecutionContext, ProbeProvider, ProviderAnswer } from "../types";
import type { ProbeEngineName } from "../../db/types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterProbeProvider implements ProbeProvider {
  public readonly engine: ProbeEngineName;
  private readonly client: OpenAI | null;
  private readonly probeModel: string;
  private readonly extractionModel: string;

  constructor(engine: ProbeEngineName, apiKey: string | undefined, probeModel: string, extractionModel: string) {
    this.engine = engine;
    this.client = apiKey
      ? new OpenAI({
          apiKey,
          baseURL: OPENROUTER_BASE_URL,
        })
      : null;
    this.probeModel = probeModel;
    this.extractionModel = extractionModel;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async answer(prompt: string, context: ProbeExecutionContext): Promise<ProviderAnswer> {
    if (!this.client) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const response = await this.client.chat.completions.create({
      model: this.probeModel,
      temperature: 0.2,
      max_tokens: 900,
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
    });

    const text = response.choices[0]?.message?.content ?? "";

    return {
      model: response.model,
      rawResponse: text,
      normalizedAnswer: normalizeWhitespace(text),
      latencyMs: Date.now() - startedAt,
      usage: {
        ...(response.usage?.prompt_tokens !== undefined ? { inputTokens: response.usage.prompt_tokens } : {}),
        ...(response.usage?.completion_tokens !== undefined ? { outputTokens: response.usage.completion_tokens } : {}),
      },
    };
  }

  async extract(rawAnswer: string, context: ProbeExecutionContext): Promise<CitationExtraction> {
    if (!this.client) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const response = await this.client.chat.completions.create({
      model: this.extractionModel,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Extract citation information from the answer.",
            "Return a strict JSON object with keys:",
            "brands_mentioned, brands_cited, cited_urls, off_site_sources, sentiment, recommendation_winner, missing_brands.",
            "Use only exact URLs present in the answer.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Brand: ${context.brand.name}`,
            `Brand domain: ${context.brand.domain}`,
            `Tracked competitors: ${(context.competitors ?? []).map((item) => item.name).join(", ") || "none"}`,
            `Answer:\n${rawAnswer}`,
          ].join("\n\n"),
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = parseJsonExtraction(text);
    if (parsed) {
      return CitationExtractionSchema.parse(parsed);
    }

    return fallbackExtraction(rawAnswer, context);
  }
}
