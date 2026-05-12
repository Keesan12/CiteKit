import { z } from "zod";
import type {
  WorkflowId as DbWorkflowId,
  WorkflowStageName,
  WorkflowTier as DbWorkflowTier,
  WorkspacePlan,
} from "../db/types";

export const WORKFLOW_STAGE_NAMES = ["probe", "diagnose", "fix", "verify"] as const;
export const WorkflowStageSchema = z.enum(WORKFLOW_STAGE_NAMES);
export type WorkflowStage = WorkflowStageName;

export const WORKFLOW_TIER_VALUES = [1, 2, 3, 4, 5] as const;
export const WorkflowTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type WorkflowTierValue = DbWorkflowTier;

export const WORKFLOW_IDS = [
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
] as const;
export const WorkflowIdSchema = z.enum(WORKFLOW_IDS);

export const WorkflowMetaSchema = z.object({
  id: WorkflowIdSchema,
  name: z.string().min(1),
  tier: WorkflowTierSchema,
  summary: z.string().min(1),
  oss_safe: z.boolean(),
  requires_human_approval_for_fix: z.boolean(),
  trace_event_prefix: z.string().min(1),
  sansa_signals: z.array(z.string().min(1)).default([]),
  stages: z.array(WorkflowStageSchema).min(1),
});
export type WorkflowMeta = z.infer<typeof WorkflowMetaSchema>;

export interface WorkflowStageOutputMap {
  probe?: unknown;
  diagnose?: unknown;
  fix?: unknown;
  verify?: unknown;
}

export interface WorkflowStageExecutionContext<
  TInput,
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
> {
  workflow: WorkflowMeta;
  input: TInput;
  stage: WorkflowStage;
  outputs: Readonly<Partial<TOutputs>>;
  metadata: WorkflowExecutionMetadata;
  signal?: AbortSignal;
}

export type WorkflowStageHandler<
  TInput,
  TOutput,
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
> = (
  context: WorkflowStageExecutionContext<TInput, TOutputs>,
) => Promise<TOutput> | TOutput;

export type WorkflowStageHandlers<
  TInput,
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
> = Partial<{
  [TStage in WorkflowStage]: WorkflowStageHandler<TInput, TOutputs[TStage], TOutputs>;
}>;

export interface WorkflowStageError {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

export interface WorkflowExecutionMetadata {
  workflow_run_id: string | null;
  workflow_id: DbWorkflowId;
  workflow_stage: WorkflowStage;
  score: number | null;
  trace_metadata: Record<string, unknown>;
  requires_human_approval: boolean;
}

export interface WorkflowRunMetadataInput {
  workflow_run_id?: string | null;
  score?: number | null;
  trace_metadata?: Record<string, unknown>;
  requires_human_approval?: boolean;
}

export interface WorkflowStageSuccess<TOutput> extends WorkflowExecutionMetadata {
  status: "success";
  output: TOutput;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface WorkflowStageFailure extends WorkflowExecutionMetadata {
  status: "failed";
  error: WorkflowStageError;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export type WorkflowStageResult<TOutput> = WorkflowStageSuccess<TOutput> | WorkflowStageFailure;

export type WorkflowStageResults<
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
> = Partial<{
  [TStage in WorkflowStage]: WorkflowStageResult<TOutputs[TStage]>;
}>;

export interface WorkflowRunResult<
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
> {
  workflow_run_id: string | null;
  workflow_id: DbWorkflowId;
  workflow: WorkflowMeta;
  score: number | null;
  trace_metadata: Record<string, unknown>;
  requires_human_approval: boolean;
  selectedStages: readonly WorkflowStage[];
  status: "success" | "failed";
  completedStages: WorkflowStage[];
  failedStage?: WorkflowStage;
  results: WorkflowStageResults<TOutputs>;
}

export interface WorkflowRunOptions extends WorkflowRunMetadataInput {
  stages?: readonly WorkflowStage[];
  planTier?: WorkspacePlan;
  enforcePlanTier?: boolean;
  haltOnError?: boolean;
  signal?: AbortSignal;
}

export interface WorkflowRunRequest<
  TInput,
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
> extends WorkflowRunOptions {
  workflowId: DbWorkflowId;
  input: TInput;
  handlers: WorkflowStageHandlers<TInput, TOutputs>;
}

export interface WorkflowStageRunRequest<
  TInput,
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
  TStage extends WorkflowStage = WorkflowStage,
> extends WorkflowRunOptions {
  workflowId: DbWorkflowId;
  stage: TStage;
  input: TInput;
  handlers: WorkflowStageHandlers<TInput, TOutputs>;
  outputs?: Partial<TOutputs>;
}

export class WorkflowConfigurationError extends Error {
  readonly workflowId?: DbWorkflowId;
  readonly stage?: WorkflowStage;
  readonly code: "WORKFLOW_NOT_FOUND" | "WORKFLOW_NOT_ALLOWED" | "MISSING_STAGE_HANDLER";

  constructor(
    code: "WORKFLOW_NOT_FOUND" | "WORKFLOW_NOT_ALLOWED" | "MISSING_STAGE_HANDLER",
    message: string,
    options?: {
      workflowId?: DbWorkflowId;
      stage?: WorkflowStage;
    },
  ) {
    super(message);
    this.name = "WorkflowConfigurationError";
    this.code = code;

    if (options?.workflowId) {
      this.workflowId = options.workflowId;
    }

    if (options?.stage) {
      this.stage = options.stage;
    }
  }
}

export function defineWorkflowStageHandlers<
  TInput,
  TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
>(handlers: WorkflowStageHandlers<TInput, TOutputs>): WorkflowStageHandlers<TInput, TOutputs> {
  return handlers;
}
