import type { WorkspacePlan } from "../db/types";
import { canRunWorkflowOnPlan, getWorkflowMeta } from "./registry";
import {
  WORKFLOW_STAGE_NAMES,
  type WorkflowExecutionMetadata,
  type WorkflowRunRequest,
  type WorkflowRunResult,
  type WorkflowStage,
  type WorkflowStageError,
  type WorkflowStageOutputMap,
  type WorkflowStageResult,
  type WorkflowStageRunRequest,
  WorkflowConfigurationError,
} from "./types";

function serializeWorkflowError(error: unknown): WorkflowStageError {
  if (error instanceof Error) {
    const maybeCode = "code" in error ? error.code : undefined;
    const serialized: WorkflowStageError = {
      name: error.name,
      message: error.message,
    };

    if (typeof maybeCode === "string") {
      serialized.code = maybeCode;
    }

    if (typeof error.stack === "string") {
      serialized.stack = error.stack;
    }

    return serialized;
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : "Unknown workflow stage failure",
  };
}

function resolveSelectedStages(stages?: readonly WorkflowStage[]): WorkflowStage[] {
  if (!stages || stages.length === 0) {
    return [...WORKFLOW_STAGE_NAMES];
  }

  const requested = new Set(stages);
  return WORKFLOW_STAGE_NAMES.filter((stage) => requested.has(stage));
}

function assertWorkflowAccess(workflowId: WorkflowRunRequest<unknown>["workflowId"], planTier?: WorkspacePlan): void {
  if (!planTier) {
    return;
  }

  if (!canRunWorkflowOnPlan(planTier, workflowId)) {
    throw new WorkflowConfigurationError(
      "WORKFLOW_NOT_ALLOWED",
      `Workflow ${workflowId} is not available on the ${planTier} plan tier.`,
      { workflowId },
    );
  }
}

function buildTraceMetadata(
  baseMetadata: Record<string, unknown> | undefined,
  workflow: NonNullable<ReturnType<typeof getWorkflowMeta>>,
  stage: WorkflowStage,
): Record<string, unknown> {
  return {
    trace_event_prefix: workflow.trace_event_prefix,
    trace_event: `${workflow.trace_event_prefix}.${stage}`,
    sansa_signals: workflow.sansa_signals,
    ...(baseMetadata ?? {}),
  };
}

function buildRunTraceMetadata(
  baseMetadata: Record<string, unknown> | undefined,
  workflow: NonNullable<ReturnType<typeof getWorkflowMeta>>,
): Record<string, unknown> {
  return {
    trace_event_prefix: workflow.trace_event_prefix,
    sansa_signals: workflow.sansa_signals,
    ...(baseMetadata ?? {}),
  };
}

export class WorkflowRunner {
  async run<TInput, TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap>(
    request: WorkflowRunRequest<TInput, TOutputs>,
  ): Promise<WorkflowRunResult<TOutputs>> {
    const workflow = getWorkflowMeta(request.workflowId);
    if (!workflow) {
      throw new WorkflowConfigurationError("WORKFLOW_NOT_FOUND", `Workflow ${request.workflowId} was not found.`, {
        workflowId: request.workflowId,
      });
    }

    if (request.enforcePlanTier ?? true) {
      assertWorkflowAccess(workflow.id, request.planTier);
    }

    const selectedStages = resolveSelectedStages(request.stages);
    const results: WorkflowRunResult<TOutputs>["results"] = {};
    const outputs: Partial<TOutputs> = {};
    const completedStages: WorkflowStage[] = [];
    const runTraceMetadata = buildRunTraceMetadata(request.trace_metadata, workflow);
    const requiresHumanApproval = request.requires_human_approval ?? workflow.requires_human_approval_for_fix;
    let failedStage: WorkflowStage | undefined;

    for (const stage of selectedStages) {
      const stageResult = await this.runStage({
        workflowId: workflow.id,
        stage,
        input: request.input,
        handlers: request.handlers,
        outputs,
        ...(request.signal ? { signal: request.signal } : {}),
        ...(request.planTier ? { planTier: request.planTier } : {}),
        ...(request.enforcePlanTier !== undefined ? { enforcePlanTier: request.enforcePlanTier } : {}),
        ...(request.workflow_run_id !== undefined ? { workflow_run_id: request.workflow_run_id } : {}),
        ...(request.score !== undefined ? { score: request.score } : {}),
        ...(request.trace_metadata ? { trace_metadata: request.trace_metadata } : {}),
        ...(request.requires_human_approval !== undefined
          ? { requires_human_approval: request.requires_human_approval }
          : {}),
      });

      results[stage] = stageResult as WorkflowStageResult<TOutputs[typeof stage]>;

      if (stageResult.status === "failed") {
        failedStage = stage;

        if (request.haltOnError === false) {
          continue;
        }

        return {
          workflow_run_id: request.workflow_run_id ?? null,
          workflow_id: workflow.id,
          workflow,
          score: request.score ?? null,
          trace_metadata: runTraceMetadata,
          requires_human_approval: requiresHumanApproval,
          selectedStages,
          status: "failed",
          completedStages,
          failedStage,
          results,
        };
      }

      outputs[stage] = stageResult.output as TOutputs[typeof stage];
      completedStages.push(stage);
    }

    return {
      workflow_run_id: request.workflow_run_id ?? null,
      workflow_id: workflow.id,
      workflow,
      score: request.score ?? null,
      trace_metadata: runTraceMetadata,
      requires_human_approval: requiresHumanApproval,
      selectedStages,
      status: failedStage ? "failed" : "success",
      completedStages,
      ...(failedStage ? { failedStage } : {}),
      results,
    };
  }

  async runStage<
    TInput,
    TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap,
    TStage extends WorkflowStage = WorkflowStage,
  >(request: WorkflowStageRunRequest<TInput, TOutputs, TStage>): Promise<WorkflowStageResult<TOutputs[TStage]>> {
    const workflow = getWorkflowMeta(request.workflowId);
    if (!workflow) {
      throw new WorkflowConfigurationError("WORKFLOW_NOT_FOUND", `Workflow ${request.workflowId} was not found.`, {
        workflowId: request.workflowId,
      });
    }

    if (request.enforcePlanTier ?? true) {
      assertWorkflowAccess(workflow.id, request.planTier);
    }

    const handler = request.handlers[request.stage];
    if (!handler) {
      throw new WorkflowConfigurationError(
        "MISSING_STAGE_HANDLER",
        `Workflow ${workflow.id} is missing a ${request.stage} stage handler.`,
        { workflowId: workflow.id, stage: request.stage },
      );
    }

    if (request.signal?.aborted) {
      const abortError = new Error("Workflow stage execution was aborted before it started.");
      abortError.name = "AbortError";
      return this.buildFailureResult(
        this.buildStageMetadata(workflow, request.stage, request),
        abortError,
        Date.now(),
        new Date().toISOString(),
      );
    }

    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const stageMetadata = this.buildStageMetadata(workflow, request.stage, request);

    try {
      const output = await handler({
        workflow,
        input: request.input,
        stage: request.stage,
        outputs: Object.freeze({ ...(request.outputs ?? {}) }) as Readonly<Partial<TOutputs>>,
        metadata: stageMetadata,
        ...(request.signal ? { signal: request.signal } : {}),
      });
      const finishedAt = new Date().toISOString();

      return {
        ...stageMetadata,
        status: "success",
        output,
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedAtMs,
      };
    } catch (error) {
      return this.buildFailureResult(stageMetadata, error, startedAtMs, startedAt);
    }
  }

  private buildStageMetadata<TInput, TOutputs extends WorkflowStageOutputMap = WorkflowStageOutputMap>(
    workflow: NonNullable<ReturnType<typeof getWorkflowMeta>>,
    stage: WorkflowStage,
    request: Pick<
      WorkflowStageRunRequest<TInput, TOutputs>,
      "workflow_run_id" | "score" | "trace_metadata" | "requires_human_approval"
    >,
  ): WorkflowExecutionMetadata {
    return {
      workflow_run_id: request.workflow_run_id ?? null,
      workflow_id: workflow.id,
      workflow_stage: stage,
      score: request.score ?? null,
      trace_metadata: buildTraceMetadata(request.trace_metadata, workflow, stage),
      requires_human_approval: request.requires_human_approval ?? workflow.requires_human_approval_for_fix,
    };
  }

  private buildFailureResult(
    metadata: WorkflowExecutionMetadata,
    error: unknown,
    startedAtMs: number,
    startedAt: string,
  ): WorkflowStageResult<never> {
    return {
      ...metadata,
      status: "failed",
      error: serializeWorkflowError(error),
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
    };
  }
}

export function createWorkflowRunner(): WorkflowRunner {
  return new WorkflowRunner();
}
