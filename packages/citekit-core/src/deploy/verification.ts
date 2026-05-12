import { z } from "zod";

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\b/g,
  /\b(?:xox[baprs]-[A-Za-z0-9-]+)\b/g,
  /\b(?:AIza[0-9A-Za-z_-]{20,})\b/g,
  /\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+)\b/g,
  /\b(?:Bearer|Token|Basic)\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /\b[A-Fa-f0-9]{32,}\b/g,
];

const PASS_STATES = new Set(["pass", "passed", "success", "successful", "succeeded", "ready", "completed"]);
const FAIL_STATES = new Set(["fail", "failed", "failure", "error", "errored", "timed_out", "timeout", "cancelled"]);
const PENDING_STATES = new Set([
  "pending",
  "queued",
  "running",
  "waiting",
  "in_progress",
  "created",
  "processing",
]);

function normalizeState(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function sanitizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported evidence URL protocol: ${parsed.protocol}`);
  }

  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString();
}

export function sanitizeLogSummary(summary: string | null | undefined, maxLength = 500): string | null {
  if (!summary) {
    return null;
  }

  let sanitized = summary.replace(/\r\n/g, "\n");

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  sanitized = sanitized.trim();
  if (sanitized.length === 0) {
    return null;
  }

  if (sanitized.length > maxLength) {
    return `${sanitized.slice(0, maxLength - 3).trimEnd()}...`;
  }

  return sanitized;
}

const EvidenceUrlSchema = z.string().url().transform(sanitizeUrl);

const VerificationEvidenceSchema = z.object({
  url: EvidenceUrlSchema.optional(),
  urls: z.array(EvidenceUrlSchema).default([]),
  logSummary: z.string().optional(),
  deploymentId: z.string().trim().min(1).max(200).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
});

const VerificationStateSchema = z.object({
  state: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500).optional(),
});

export const DeployVerificationInputSchema = z.object({
  workflowRunId: z.string().trim().min(1).max(200).optional(),
  expectedUrl: EvidenceUrlSchema.optional(),
  expectedUrls: z.array(EvidenceUrlSchema).default([]),
  deployment: VerificationStateSchema.optional(),
  checks: z.array(VerificationStateSchema).default([]),
  evidence: VerificationEvidenceSchema.default({ urls: [] }),
});

export type DeployVerificationInput = z.input<typeof DeployVerificationInputSchema>;
export type DeployVerificationStatus = "pass" | "fail" | "pending";

export interface DeployVerificationResult {
  workflowRunId: string | null;
  status: DeployVerificationStatus;
  reasons: string[];
  evidence: {
    provider: string | null;
    deploymentId: string | null;
    urls: string[];
    logSummary: string | null;
  };
}

function classifyNormalizedState(state: string): DeployVerificationStatus {
  if (FAIL_STATES.has(state)) {
    return "fail";
  }

  if (PASS_STATES.has(state)) {
    return "pass";
  }

  if (PENDING_STATES.has(state)) {
    return "pending";
  }

  return "pending";
}

function mergeUrls(expectedUrls: string[], evidenceUrl: string | undefined, evidenceUrls: string[]): string[] {
  return Array.from(new Set([...expectedUrls, ...(evidenceUrl ? [evidenceUrl] : []), ...evidenceUrls]));
}

export function classifyDeployVerification(input: DeployVerificationInput): DeployVerificationResult {
  const parsed = DeployVerificationInputSchema.parse(input);
  const expectedUrls = Array.from(
    new Set([...(parsed.expectedUrl ? [parsed.expectedUrl] : []), ...parsed.expectedUrls]),
  );
  const evidenceUrls = mergeUrls(expectedUrls, parsed.evidence.url, parsed.evidence.urls);
  const reasons: string[] = [];

  const deploymentState = parsed.deployment ? normalizeState(parsed.deployment.state) : null;
  const deploymentStatus = deploymentState ? classifyNormalizedState(deploymentState) : "pending";
  if (parsed.deployment?.description) {
    reasons.push(parsed.deployment.description);
  } else if (deploymentState) {
    reasons.push(`Deployment state is ${deploymentState}.`);
  }

  const checkStatuses = parsed.checks.map((check) => ({
    state: normalizeState(check.state),
    description: check.description,
  }));

  for (const check of checkStatuses) {
    reasons.push(check.description ?? `Verification check is ${check.state}.`);
  }

  const hasFailingCheck = checkStatuses.some((check) => classifyNormalizedState(check.state) === "fail");
  const hasPendingCheck = checkStatuses.some((check) => classifyNormalizedState(check.state) === "pending");
  const hasPassingChecks = checkStatuses.length > 0 && checkStatuses.every((check) => classifyNormalizedState(check.state) === "pass");

  let status: DeployVerificationStatus = "pending";

  if (deploymentStatus === "fail" || hasFailingCheck) {
    status = "fail";
  } else if (deploymentStatus === "pass" && (checkStatuses.length === 0 || hasPassingChecks)) {
    status = "pass";
  } else if (deploymentStatus === "pending" || hasPendingCheck) {
    status = "pending";
  }

  return {
    workflowRunId: parsed.workflowRunId ?? null,
    status,
    reasons,
    evidence: {
      provider: parsed.evidence.provider ?? null,
      deploymentId: parsed.evidence.deploymentId ?? null,
      urls: evidenceUrls,
      logSummary: sanitizeLogSummary(parsed.evidence.logSummary),
    },
  };
}
