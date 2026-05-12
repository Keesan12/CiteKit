import type { ProbeEngineName } from "../db/types";
import { CitationExtractionSchema } from "../schema/core";
import { buildTracePayload } from "../trace/types";
import { sha256 } from "../utils/hash";
import { extractUrlsFromText } from "../utils/text";
import type { ProbeExecutionContext, ProbeProvider, ProbeRunResult } from "./types";

const MODEL_PRICING: Partial<Record<ProbeEngineName, { inputPerM: number; outputPerM: number }>> = {
  gpt4o: { inputPerM: 0.4, outputPerM: 1.6 },
  claude: { inputPerM: 3, outputPerM: 15 },
  gemini: { inputPerM: 0.35, outputPerM: 1.05 },
  perplexity: { inputPerM: 0, outputPerM: 0 },
};

function estimateCostUsd(
  engine: ProbeEngineName,
  usage?: { inputTokens?: number; outputTokens?: number },
): number {
  const pricing = MODEL_PRICING[engine];
  if (!pricing || !usage?.inputTokens || !usage.outputTokens) {
    return 0;
  }

  return Number(
    (
      (usage.inputTokens / 1_000_000) * pricing.inputPerM +
      (usage.outputTokens / 1_000_000) * pricing.outputPerM
    ).toFixed(6),
  );
}

export async function runProbe(
  provider: ProbeProvider,
  context: ProbeExecutionContext,
): Promise<ProbeRunResult> {
  const answer = await provider.answer(context.prompt.prompt_text, context);
  const extraction = CitationExtractionSchema.parse(await provider.extract(answer.rawResponse, context));
  const claimedUrls = Array.from(new Set([...extraction.cited_urls, ...extractUrlsFromText(answer.rawResponse)]));
  return {
    engine: provider.engine,
    model: answer.model,
    rawResponse: answer.rawResponse,
    normalizedAnswer: answer.normalizedAnswer,
    extraction,
    claimedUrls,
    costUsd: estimateCostUsd(provider.engine, answer.usage),
    latencyMs: answer.latencyMs,
  };
}

export async function runProbeBatch(
  providers: ProbeProvider[],
  context: ProbeExecutionContext,
): Promise<{ runs: ProbeRunResult[]; traces: ReturnType<typeof buildTracePayload>[] }> {
  const runs: ProbeRunResult[] = [];
  const traces: ReturnType<typeof buildTracePayload>[] = [];

  for (const provider of providers) {
    const result = await runProbe(provider, context);
    runs.push(result);
    traces.push(
      buildTracePayload({
        agentName: `${provider.engine}-probe`,
        brandId: context.brand.id,
        actionType: "probe",
        inputHash: sha256(context.prompt.prompt_text),
        outputHash: sha256(result.rawResponse),
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        success: true,
        sansaUsed: false,
      }),
    );
  }

  return { runs, traces };
}

