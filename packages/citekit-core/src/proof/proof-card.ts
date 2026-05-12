import { z } from "zod";
import type { FixStatus, FixType, ProbeEngineName, PromptIntent, RecommendationStatus, WorkflowId } from "../db/types";
import { sha256 } from "../utils/hash";

const PROBE_ENGINES = ["gpt4o", "claude", "perplexity", "gemini", "grok"] as const satisfies readonly ProbeEngineName[];
const PROMPT_INTENTS = [
  "best_tool",
  "comparison",
  "alternative",
  "use_case",
  "pricing",
  "integration",
  "compliance",
] as const satisfies readonly PromptIntent[];
const RECOMMENDATION_STATUSES = [
  "won",
  "visible",
  "at_risk",
  "lost",
  "wrong",
  "unanswerable",
] as const satisfies readonly RecommendationStatus[];
const FIX_TYPES = [
  "faq",
  "schema",
  "comparison_page",
  "docs_update",
  "llms_txt",
  "homepage_section",
  "g2_brief",
  "earned_media_brief",
  "reddit_brief",
] as const satisfies readonly FixType[];
const FIX_STATUSES = ["draft", "approved", "rejected", "deployed"] as const satisfies readonly FixStatus[];
const WORKFLOW_IDS = [
  "WF-01",
  "WF-02",
  "WF-03",
  "WF-04",
  "WF-05",
  "WF-06",
  "WF-07",
  "WF-08",
  "WF-09",
  "WF-10",
  "WF-11",
  "WF-12",
  "WF-13",
  "WF-14",
  "WF-15",
  "WF-16",
  "WF-17",
  "WF-18",
  "WF-19",
  "WF-20",
] as const satisfies readonly WorkflowId[];

const ProbeEngineSchema = z.enum(PROBE_ENGINES);
const PromptIntentSchema = z.enum(PROMPT_INTENTS);
const RecommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);
const FixTypeSchema = z.enum(FIX_TYPES);
const FixStatusSchema = z.enum(FIX_STATUSES);
const WorkflowIdSchema = z.enum(WORKFLOW_IDS);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function uniqueValues<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

const MetricSchema = z.number().min(0).max(1);

const PromptExperimentSchema = z.object({
  promptId: z.string().trim().min(1).max(200),
  promptText: z.string().min(1).optional(),
  promptHash: z.string().trim().regex(/^[a-f0-9]{64}$/).optional(),
  intent: PromptIntentSchema.optional(),
  engine: ProbeEngineSchema,
  beforeCitationShare: MetricSchema,
  afterCitationShare: MetricSchema,
  beforeRecommendationStatus: RecommendationStatusSchema.optional(),
  afterRecommendationStatus: RecommendationStatusSchema.optional(),
});

const FixMetadataSchema = z.object({
  fixId: z.string().trim().min(1).max(200),
  fixType: FixTypeSchema,
  status: FixStatusSchema,
  title: z.string().min(1).max(200).optional(),
  deployedAt: z.string().datetime().optional(),
  workflowId: WorkflowIdSchema.optional(),
  contentHash: z.string().trim().regex(/^[a-f0-9]{64}$/).optional(),
  draftContent: z.string().min(1).optional(),
});

export const ProofCardInputSchema = z
  .object({
    experimentId: z.string().trim().min(1).max(200),
    workflowRunId: z.string().trim().min(1).max(200).optional(),
    workflowId: WorkflowIdSchema.optional(),
    generatedAt: z.string().datetime(),
    attributionConfidence: z.number().min(0).max(1).optional(),
    predictedLift: z.number().min(-1).max(1).optional(),
    fix: FixMetadataSchema,
    promptExperiments: z.array(PromptExperimentSchema).min(1),
  })
  .superRefine((input, context) => {
    const seen = new Set<string>();

    for (const prompt of input.promptExperiments) {
      const key = `${prompt.promptId}:${prompt.engine}`;
      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each prompt/engine pair must be unique.",
          path: ["promptExperiments"],
        });
        break;
      }
      seen.add(key);
    }
  });

export type ProofCardInput = z.input<typeof ProofCardInputSchema>;

export interface PublicProofCard {
  schemaVersion: "1.0";
  experimentId: string;
  workflowRunId: string | null;
  workflowId: WorkflowId | null;
  generatedAt: string;
  result: "improved" | "flat" | "regressed";
  deltas: {
    citationShare: number;
    improvementRate: number;
    regressionRate: number;
    affectedPromptCount: number;
  };
  confidence: {
    attribution: number;
    observed: number;
    overall: number;
  };
  volatility: {
    before: number;
    after: number;
    delta: number;
  };
  before: {
    averageCitationShare: number;
    sampleSize: number;
  };
  after: {
    averageCitationShare: number;
    sampleSize: number;
  };
  affectedPrompts: Array<{
    promptId: string;
    promptHash: string;
    intent: PromptIntent | null;
    engine: ProbeEngineName;
    citationShareDelta: number;
    statusChanged: boolean;
  }>;
  engines: ProbeEngineName[];
  fix: {
    fixId: string;
    fixType: FixType;
    status: FixStatus;
    title: string | null;
    deployedAt: string | null;
    workflowId: WorkflowId | null;
    contentHash: string;
  };
  sansaObservation: {
    experimentId: string;
    workflowRunId: string | null;
    contentHash: string;
    predictedLift: number | null;
    measuredLift: number;
    confidence: number;
    volatilityDelta: number;
    promptHashes: string[];
    engines: ProbeEngineName[];
  };
}

function resolvePromptHash(prompt: z.infer<typeof PromptExperimentSchema>): string {
  return prompt.promptHash ?? sha256(prompt.promptText ?? prompt.promptId);
}

function resolveFixContentHash(fix: z.infer<typeof FixMetadataSchema>): string {
  return fix.contentHash ?? sha256(fix.draftContent ?? `${fix.fixId}:${fix.fixType}:${fix.status}`);
}

export function buildPublicProofCard(input: ProofCardInput): PublicProofCard {
  const parsed = ProofCardInputSchema.parse(input);
  const beforeValues = parsed.promptExperiments.map((prompt) => prompt.beforeCitationShare);
  const afterValues = parsed.promptExperiments.map((prompt) => prompt.afterCitationShare);
  const averageBefore = average(beforeValues);
  const averageAfter = average(afterValues);
  const volatilityBefore = standardDeviation(beforeValues);
  const volatilityAfter = standardDeviation(afterValues);
  const promptDetails = parsed.promptExperiments.map((prompt) => {
    const citationShareDelta = prompt.afterCitationShare - prompt.beforeCitationShare;
    return {
      promptId: prompt.promptId,
      promptHash: resolvePromptHash(prompt),
      intent: prompt.intent ?? null,
      engine: prompt.engine,
      citationShareDelta,
      statusChanged:
        prompt.beforeRecommendationStatus !== undefined &&
        prompt.afterRecommendationStatus !== undefined &&
        prompt.beforeRecommendationStatus !== prompt.afterRecommendationStatus,
    };
  });
  const engines = uniqueValues(parsed.promptExperiments.map((prompt) => prompt.engine));

  const improvementRate =
    promptDetails.filter((prompt) => prompt.citationShareDelta > 0.01 || prompt.statusChanged).length /
    promptDetails.length;
  const regressionRate = promptDetails.filter((prompt) => prompt.citationShareDelta < -0.01).length / promptDetails.length;
  const observedConfidence = clamp(
    (1 - Math.min(1, Math.abs(volatilityAfter - volatilityBefore) + volatilityAfter)) *
      Math.min(1, parsed.promptExperiments.length / 5),
    0,
    1,
  );
  const attributionConfidence = parsed.attributionConfidence ?? observedConfidence;
  const overallConfidence = clamp((observedConfidence + attributionConfidence) / 2, 0, 1);
  const measuredLift = averageAfter - averageBefore;
  const roundedMeasuredLift = roundMetric(measuredLift);

  return {
    schemaVersion: "1.0",
    experimentId: parsed.experimentId,
    workflowRunId: parsed.workflowRunId ?? null,
    workflowId: (parsed.workflowId ?? parsed.fix.workflowId ?? null) as WorkflowId | null,
    generatedAt: parsed.generatedAt,
    result: roundedMeasuredLift > 0.01 ? "improved" : roundedMeasuredLift < -0.01 ? "regressed" : "flat",
    deltas: {
      citationShare: roundedMeasuredLift,
      improvementRate: roundMetric(improvementRate),
      regressionRate: roundMetric(regressionRate),
      affectedPromptCount: promptDetails.filter((prompt) => Math.abs(prompt.citationShareDelta) >= 0.01).length,
    },
    confidence: {
      attribution: roundMetric(attributionConfidence),
      observed: roundMetric(observedConfidence),
      overall: roundMetric(overallConfidence),
    },
    volatility: {
      before: roundMetric(volatilityBefore),
      after: roundMetric(volatilityAfter),
      delta: roundMetric(volatilityAfter - volatilityBefore),
    },
    before: {
      averageCitationShare: roundMetric(averageBefore),
      sampleSize: parsed.promptExperiments.length,
    },
    after: {
      averageCitationShare: roundMetric(averageAfter),
      sampleSize: parsed.promptExperiments.length,
    },
    affectedPrompts: promptDetails.map((prompt) => ({
      promptId: prompt.promptId,
      promptHash: prompt.promptHash,
      intent: prompt.intent,
      engine: prompt.engine,
      citationShareDelta: roundMetric(prompt.citationShareDelta),
      statusChanged: prompt.statusChanged,
    })),
    engines,
    fix: {
      fixId: parsed.fix.fixId,
      fixType: parsed.fix.fixType as FixType,
      status: parsed.fix.status as FixStatus,
      title: parsed.fix.title ?? null,
      deployedAt: parsed.fix.deployedAt ?? null,
      workflowId: (parsed.fix.workflowId ?? null) as WorkflowId | null,
      contentHash: resolveFixContentHash(parsed.fix),
    },
    sansaObservation: {
      experimentId: parsed.experimentId,
      workflowRunId: parsed.workflowRunId ?? null,
      contentHash: resolveFixContentHash(parsed.fix),
      predictedLift: parsed.predictedLift ?? null,
      measuredLift: roundedMeasuredLift,
      confidence: roundMetric(overallConfidence),
      volatilityDelta: roundMetric(volatilityAfter - volatilityBefore),
      promptHashes: promptDetails.map((prompt) => prompt.promptHash),
      engines,
    },
  };
}
