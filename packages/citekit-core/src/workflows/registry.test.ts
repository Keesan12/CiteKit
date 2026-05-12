import { describe, expect, it } from "vitest";
import {
  WORKFLOW_IDS,
  WORKFLOW_REGISTRY,
  WORKFLOW_STAGE_NAMES,
  canRunWorkflowOnPlan,
  getWorkflowMeta,
  listOssSafeWorkflows,
  listWorkflowsByTier,
} from "./index";

describe("workflow registry", () => {
  it("tracks all 20 workflows with unique ids and canonical stages", () => {
    expect(WORKFLOW_REGISTRY).toHaveLength(20);
    expect(WORKFLOW_REGISTRY.map((workflow) => workflow.id)).toEqual([...WORKFLOW_IDS]);
    expect(new Set(WORKFLOW_REGISTRY.map((workflow) => workflow.id)).size).toBe(WORKFLOW_IDS.length);

    for (const workflow of WORKFLOW_REGISTRY) {
      expect(workflow.stages).toEqual([...WORKFLOW_STAGE_NAMES]);
      expect(workflow.trace_event_prefix.length).toBeGreaterThan(0);
    }
  });

  it("preserves tier and plan access boundaries from the uploaded pack", () => {
    expect(listWorkflowsByTier(1).map((workflow) => workflow.id)).toEqual(["WF-01", "WF-02", "WF-03", "WF-04"]);
    expect(listOssSafeWorkflows().every((workflow) => workflow.oss_safe)).toBe(true);
    expect(canRunWorkflowOnPlan("oss", "WF-01")).toBe(true);
    expect(canRunWorkflowOnPlan("oss", "WF-18")).toBe(false);
    expect(getWorkflowMeta("WF-20")?.requires_human_approval_for_fix).toBe(true);
  });
});
