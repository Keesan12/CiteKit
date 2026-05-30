export interface TracePayload {
  agentName: string;
  brandId?: string | null;
  workflowRunId?: string | null;
  workflowId?: string | null;
  workflowStage?: "probe" | "diagnose" | "fix" | "verify" | null;
  actionType?: string | null;
  inputHash?: string | null;
  outputHash?: string | null;
  costUsd?: number;
  latencyMs?: number | null;
  success?: boolean;
  errorMessage?: string | null;
  aiAssisted?: boolean;
  metadata?: Record<string, unknown>;
}

export function buildTracePayload(payload: TracePayload): Required<TracePayload> {
  return {
    agentName: payload.agentName,
    brandId: payload.brandId ?? null,
    workflowRunId: payload.workflowRunId ?? null,
    workflowId: payload.workflowId ?? null,
    workflowStage: payload.workflowStage ?? null,
    actionType: payload.actionType ?? null,
    inputHash: payload.inputHash ?? null,
    outputHash: payload.outputHash ?? null,
    costUsd: payload.costUsd ?? 0,
    latencyMs: payload.latencyMs ?? null,
    success: payload.success ?? true,
    errorMessage: payload.errorMessage ?? null,
    aiAssisted: payload.aiAssisted ?? false,
    metadata: payload.metadata ?? {},
  };
}
