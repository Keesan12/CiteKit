import type { BrandRecord, CompetitorRecord, ProbeEngineName, PromptRecord } from "../db/types";
import type { CitationExtraction } from "../schema/core";
import type { MartinLoopTracePayload } from "../trace/types";

export interface ProbeExecutionContext {
  brand: Pick<BrandRecord, "id" | "name" | "domain" | "category" | "description" | "target_persona">;
  prompt: Pick<PromptRecord, "id" | "prompt_text" | "intent_type">;
  competitors?: Pick<CompetitorRecord, "name" | "domain">[];
  trace?: Partial<MartinLoopTracePayload>;
}

export interface ProviderAnswer {
  model: string;
  rawResponse: string;
  normalizedAnswer: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ProbeProvider {
  readonly engine: ProbeEngineName;
  isConfigured(): boolean;
  answer(prompt: string, context: ProbeExecutionContext): Promise<ProviderAnswer>;
  extract(rawAnswer: string, context: ProbeExecutionContext): Promise<CitationExtraction>;
}

export interface ProbeRunResult {
  engine: ProbeEngineName;
  model: string;
  rawResponse: string;
  normalizedAnswer: string;
  extraction: CitationExtraction;
  claimedUrls: string[];
  costUsd: number;
  latencyMs: number;
}

