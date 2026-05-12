import { describe, expect, it } from "vitest";
import {
  buildSafeGitHubPullRequestPayload,
  validateGitHubPullRequestInput,
} from "./github-pr";

describe("github PR payload builder", () => {
  it("builds a deterministic payload with auto-merge disabled", () => {
    const payload = buildSafeGitHubPullRequestPayload({
      owner: "citekit",
      repo: "citekit-core",
      branch: "fix/proof-card",
      base: "main",
      title: "Add proof card deploy verification",
      body: "## Summary\nAdds deterministic deploy and proof helpers.\n\n## Verification\n- vitest",
      maintainerCanModify: true,
    });

    expect(payload).toEqual({
      owner: "citekit",
      repo: "citekit-core",
      branch: "fix/proof-card",
      base: "main",
      head: "fix/proof-card",
      title: "Add proof card deploy verification",
      body: "## Summary\nAdds deterministic deploy and proof helpers.\n\n## Verification\n- vitest",
      draft: false,
      maintainer_can_modify: true,
      auto_merge: false,
    });
  });

  it("accepts an owner-qualified head only when it matches the branch", () => {
    const payload = buildSafeGitHubPullRequestPayload({
      owner: "citekit",
      repo: "citekit-core",
      branch: "fix/proof-card",
      head: "keesan:fix/proof-card",
      base: "main",
      title: "Ship safe deploy primitives",
      body: "## Summary\nAdds safe deploy primitives and proof data generation.\n\n## Verification\n- vitest",
    });

    expect(payload.head).toBe("keesan:fix/proof-card");
  });

  it("fails fast on invalid refs and mismatched head branches", () => {
    expect(() =>
      validateGitHubPullRequestInput({
        owner: "citekit",
        repo: "citekit-core",
        branch: "feature with spaces",
        base: "main",
        title: "Bad ref example",
        body: "This body is long enough to reach validation and prove the ref is rejected.",
      }),
    ).toThrow(/Invalid git ref/);

    expect(() =>
      buildSafeGitHubPullRequestPayload({
        owner: "citekit",
        repo: "citekit-core",
        branch: "fix/proof-card",
        head: "keesan:different-branch",
        base: "main",
        title: "Head mismatch example",
        body: "This body is long enough to reach validation and prove the mismatch is rejected.",
      }),
    ).toThrow(/Head ref must point at the same branch as branch/);
  });

  it("rejects auto-merge and same-branch PRs", () => {
    expect(() =>
      buildSafeGitHubPullRequestPayload({
        owner: "citekit",
        repo: "citekit-core",
        branch: "main",
        base: "main",
        title: "Same branch should fail",
        body: "This body is long enough to confirm branch and base cannot be identical.",
      }),
    ).toThrow(/Pull request branch must differ from the base branch/);

    expect(() =>
      buildSafeGitHubPullRequestPayload({
        owner: "citekit",
        repo: "citekit-core",
        branch: "fix/proof-card",
        base: "main",
        title: "Auto merge should fail",
        body: "This body is long enough to confirm auto-merge cannot be enabled.",
        autoMerge: true as never,
      }),
    ).toThrow();
  });
});
