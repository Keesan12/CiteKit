import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { CitationExtractionSchema, type CitationExtraction } from "../../schema/core";
import { normalizeWhitespace } from "../../utils/text";
import { fallbackExtraction } from "./base";
import type { ProbeExecutionContext, ProbeProvider, ProviderAnswer } from "../types";

export class OpenAIProbeProvider implements ProbeProvider {
  public readonly engine = "gpt4o" as const;
  private readonly client: OpenAI | null;
  private readonly probeModel: string;
  private readonly extractionModel: string;

  constructor(apiKey: string | undefined, probeModel: string, extractionModel: string) {
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    this.probeModel = probeModel;
    this.extractionModel = extractionModel;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async answer(prompt: string, context: ProbeExecutionContext): Promise<ProviderAnswer> {
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const response = await this.client.responses.create({
      model: this.probeModel,
      input: [
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
      max_output_tokens: 900,
    });

    return {
      model: response.model,
      rawResponse: response.output_text,
      normalizedAnswer: normalizeWhitespace(response.output_text),
      latencyMs: Date.now() - startedAt,
      usage: {
        ...(response.usage?.input_tokens !== undefined ? { inputTokens: response.usage.input_tokens } : {}),
        ...(response.usage?.output_tokens !== undefined ? { outputTokens: response.usage.output_tokens } : {}),
      },
    };
  }

  async extract(rawAnswer: string, context: ProbeExecutionContext): Promise<CitationExtraction> {
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await this.client.responses.parse({
      model: this.extractionModel,
      input: [
        {
          role: "system",
          content:
            "Extract citation information from the answer. Return only structured data and prefer exact URLs from the answer over guessed URLs.",
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: `Brand: ${context.brand.name}` },
            { type: "input_text", text: `Brand domain: ${context.brand.domain}` },
            { type: "input_text", text: `Tracked competitors: ${(context.competitors ?? []).map((item) => item.name).join(", ") || "none"}` },
            { type: "input_text", text: `Answer:\n${rawAnswer}` },
          ],
        },
      ],
      text: {
        format: zodTextFormat(CitationExtractionSchema, "citation_extraction"),
      },
    });

    for (const output of response.output) {
      if (output.type !== "message") {
        continue;
      }

      for (const item of output.content) {
        if (item.type === "output_text" && item.parsed) {
          return CitationExtractionSchema.parse(item.parsed);
        }
      }
    }

    return fallbackExtraction(rawAnswer, context);
  }
}
