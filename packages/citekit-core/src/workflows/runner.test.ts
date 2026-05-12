import { describe, expect, it } from "vitest";
import {
  createWorkflowRunner,
  defineWorkflowStageHandlers,
  type WorkflowStage,
} from "./index";

describe("workflow runner", () => {
  it("runs stages in canonical order and passes prior outputs into later stages", async () => {
    const runner = createWorkflowRunner();
    const observed: string[] = [];

    const result = await runner.run({
      workflowId: "WF-01",
      input: { domain: "citeops.ai" },
      handlers: defineWorkflowStageHandlers<
        { domain: string },
        {
          probe: { url: string };
          diagnose: { summary: string };
          fix: { patch: string };
          verify: { verified: boolean };
        }
      >({
        probe: ({ input }) => {
          observed.push("probe");
          return { url: `https://${input.domain}/llms.txt` };
        },
        diagnose: ({ outputs }) => {
          observed.push(`diagnose:${outputs.probe?.url ?? "missing"}`);
          return { summary: `checked ${outputs.probe?.url ?? "unknown"}` };
        },
        fix: ({ outputs }) => {
          observed.push(`fix:${outputs.diagnose?.summary ?? "missing"}`);
          return { patch: "generated" };
        },
        verify: ({ outputs }) => {
          observed.push(`verify:${outputs.fix?.patch ?? "missing"}`);
          return { verified: true };
        },
      }),
    });

    expect(result.status).toBe("success");
    expect(result.completedStages).toEqual(["probe", "diagnose", "fix", "verify"]);
    expect(result.results.probe?.status).toBe("success");
    expect(result.workflow_id).toBe("WF-01");
    expect(result.requires_human_approval).toBe(false);
    expect(result.results.verify).toMatchObject({
      status: "success",
      output: { verified: true },
      workflow_stage: "verify",
      workflow_run_id: null,
    });
    expect(observed).toEqual([
      "probe",
      "diagnose:https://citeops.ai/llms.txt",
      "fix:checked https://citeops.ai/llms.txt",
      "verify:generated",
    ]);
  });

  it("returns a failed stage result and stops the run when a handler throws", async () => {
    const runner = createWorkflowRunner();

    const result = await runner.run({
      workflowId: "WF-03",
      input: { url: "https://citeops.ai" },
      handlers: defineWorkflowStageHandlers<
        { url: string },
        {
          probe: { url: string };
          diagnose: { summary: string };
        }
      >({
        probe: ({ input }) => ({ url: input.url }),
        diagnose: () => {
          throw new Error("schema validator unavailable");
        },
      }),
      stages: ["probe", "diagnose"],
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("diagnose");
    expect(result.completedStages).toEqual(["probe"]);
    expect(result.results.diagnose).toMatchObject({
      status: "failed",
      error: { message: "schema validator unavailable" },
    });
  });

  it("blocks non-oss-safe workflows for oss plan runs", async () => {
    const runner = createWorkflowRunner();

    await expect(
      runner.run({
        workflowId: "WF-18",
        input: { promptCount: 10 },
        planTier: "oss",
        handlers: defineWorkflowStageHandlers<{ promptCount: number }, { probe: { count: number } }>({
          probe: ({ input }) => ({ count: input.promptCount }),
        }),
        stages: ["probe"],
      }),
    ).rejects.toMatchObject({
      name: "WorkflowConfigurationError",
      code: "WORKFLOW_NOT_ALLOWED",
    });
  });

  it("throws a configuration error when a selected stage has no handler", async () => {
    const runner = createWorkflowRunner();

    await expect(
      runner.run({
        workflowId: "WF-01",
        input: { domain: "citeops.ai" },
        handlers: defineWorkflowStageHandlers<{ domain: string }, { probe: { url: string } }>({
          probe: ({ input }) => ({ url: `https://${input.domain}` }),
        }),
        stages: ["probe", "diagnose"] satisfies WorkflowStage[],
      }),
    ).rejects.toMatchObject({
      name: "WorkflowConfigurationError",
      code: "MISSING_STAGE_HANDLER",
      stage: "diagnose",
    });
  });
});
