import { describe, expect, it } from "vitest";
import { classifyDeployVerification, sanitizeLogSummary } from "./verification";

describe("deploy verification helpers", () => {
  it("classifies a successful verification and sanitizes evidence", () => {
    const result = classifyDeployVerification({
      workflowRunId: "run_123",
      expectedUrl: "https://example.com/deploy?token=secret",
      deployment: {
        state: "ready",
        description: "Deployment reached the expected ready state.",
      },
      checks: [
        {
          state: "passed",
          description: "Health checks passed.",
        },
      ],
      evidence: {
        provider: "vercel",
        deploymentId: "dep_123",
        url: "https://logs.example.com/build#private",
        logSummary: "Authorization: Bearer ghp_superSecretToken value hidden",
      },
    });

    expect(result.status).toBe("pass");
    expect(result.evidence.urls).toEqual(["https://example.com/deploy", "https://logs.example.com/build"]);
    expect(result.evidence.logSummary).toContain("[REDACTED]");
    expect(result.evidence.logSummary).not.toContain("ghp_superSecretToken");
  });

  it("classifies pending and failed states deterministically", () => {
    const pending = classifyDeployVerification({
      deployment: { state: "queued" },
      checks: [{ state: "running" }],
      evidence: { urls: [] },
    });

    expect(pending.status).toBe("pending");

    const failed = classifyDeployVerification({
      deployment: { state: "ready" },
      checks: [{ state: "failed", description: "Smoke test failed." }],
      evidence: { urls: [] },
    });

    expect(failed.status).toBe("fail");
    expect(failed.reasons).toContain("Smoke test failed.");
  });

  it("truncates long log summaries after redaction", () => {
    const summary = sanitizeLogSummary(`build output ${"line ".repeat(200)}`);

    expect(summary).not.toBeNull();
    expect(summary?.length).toBeLessThanOrEqual(500);
    expect(summary?.endsWith("...")).toBe(true);
  });

  it("rejects unsupported evidence URLs", () => {
    expect(() =>
      classifyDeployVerification({
        deployment: { state: "ready" },
        evidence: { url: "ftp://example.com/logs" },
      }),
    ).toThrow(/Unsupported evidence URL protocol/);
  });
});
