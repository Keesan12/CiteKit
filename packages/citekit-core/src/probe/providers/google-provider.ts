import { GoogleGenerativeAI } from "@google/generative-ai";
import { type CitationExtraction } from "../../schema/core";
import { fallbackExtraction, parseJsonExtraction } from "./base";
import { normalizeWhitespace } from "../../utils/text";
import type { ProbeExecutionContext, ProbeProvider, ProviderAnswer } from "../types";

export class GoogleProbeProvider implements ProbeProvider {
  public readonly engine = "gemini" as const;
  private readonly client: GoogleGenerativeAI | null;
  private readonly model: string;

  constructor(apiKey: string | undefined, model: string) {
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.model = model;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async answer(prompt: string, context: ProbeExecutionContext): Promise<ProviderAnswer> {
    if (!this.client) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const model = this.client.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(
      `You are a buyer-side research assistant. Answer directly, cite URLs when possible, and state a recommendation when one is warranted.\n\n${prompt}\n\nBrand context: ${context.brand.name} (${context.brand.domain})`,
    );
    const rawResponse = result.response.text();

    return {
      model: this.model,
      rawResponse,
      normalizedAnswer: normalizeWhitespace(rawResponse),
      latencyMs: Date.now() - startedAt,
    };
  }

  async extract(rawAnswer: string, context: ProbeExecutionContext): Promise<CitationExtraction> {
    if (!this.client) {
      throw new Error("GOOGLE_API_KEY is not configured");
    }

    const model = this.client.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(
      `Return JSON only. Extract citation data.\nBrand: ${context.brand.name}\nBrand domain: ${context.brand.domain}\nTracked competitors: ${(context.competitors ?? []).map((item) => item.name).join(", ") || "none"}\nAnswer:\n${rawAnswer}\n\nReturn JSON with keys brands_mentioned, brands_cited, cited_urls, off_site_sources, sentiment, recommendation_winner, missing_brands.`,
    );
    const rawJson = result.response.text();
    return parseJsonExtraction(rawJson) ?? fallbackExtraction(rawAnswer, context);
  }
}

