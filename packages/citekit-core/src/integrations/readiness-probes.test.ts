import { describe, expect, it, vi } from "vitest";

import { createReadOnlyIntegrationProbes } from "./readiness-probes";

function makeFetch(response: { ok: boolean; status: number; body: string }) {
  return vi.fn(async () => ({
    ok: response.ok,
    status: response.status,
    text: async () => response.body,
  }));
}

describe("read-only integration probes", () => {
  it("captures masked evidence for successful HTTP probes", async () => {
    const fetchImpl = makeFetch({
      ok: true,
      status: 200,
      body: JSON.stringify({ object: "list", data: [{ id: "gpt-4.1-mini" }] }),
    });
    const probes = createReadOnlyIntegrationProbes({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await probes.openai({
      integration: "openai",
      config: {
        apiKey: "sk-secret-openai-key",
        baseUrl: undefined,
        model: undefined,
      },
      env: {},
    });

    expect(result.status).toBe("ready");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-secret-openai-key",
        }),
      }),
    );
    expect(result.evidence?.[0]).toMatchObject({
      kind: "http",
      result: "pass",
      statusCode: 200,
      target: "https://api.openai.com/v1/models",
    });
    expect(JSON.stringify(result.evidence)).not.toContain("sk-secret-openai-key");
  });

  it("returns structured blockers when a provider-specific live probe cannot safely run", async () => {
    const probes = createReadOnlyIntegrationProbes({
      fetchImpl: makeFetch({ ok: true, status: 200, body: "{}" }) as unknown as typeof fetch,
    });

    const result = await probes.github({
      integration: "github",
      config: {
        token: undefined,
        appId: "12345",
        installationId: "67890",
        privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
        owner: "citeops",
        baseUrl: undefined,
      },
      env: {},
    });

    expect(result.status).toBe("blocked");
    if (result.status === "ready") {
      throw new Error("Expected a blocked probe result for GitHub App credentials.");
    }
    expect(result.blockers).toContain(
      "Built-in GitHub live probing currently supports GITHUB_TOKEN only. Pass a caller-supplied probe for GitHub App auth.",
    );
    expect(result.evidence?.[0]).toMatchObject({
      kind: "policy",
      result: "blocked",
    });
  });

  it("maps authentication failures to blocked without leaking API keys in evidence", async () => {
    const fetchImpl = makeFetch({
      ok: false,
      status: 401,
      body: '{"error":"invalid api key sk-bad-posthog-key"}',
    });
    const probes = createReadOnlyIntegrationProbes({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await probes.posthog({
      integration: "posthog",
      config: {
        host: "https://us.i.posthog.com",
        apiKey: "sk-bad-posthog-key",
      },
      env: {},
    });

    expect(result.status).toBe("blocked");
    if (result.status === "ready") {
      throw new Error("Expected a blocked probe result for a 401 PostHog response.");
    }
    expect(result.blockers[0]).toContain("rejected the supplied credentials");
    expect(JSON.stringify(result.evidence)).not.toContain("sk-bad-posthog-key");
    expect(result.evidence?.[0]).toMatchObject({
      kind: "http",
      result: "blocked",
      statusCode: 401,
    });
  });

  it("sanitizes Google API keys from query strings in evidence", async () => {
    const fetchImpl = makeFetch({
      ok: false,
      status: 403,
      body: '{"error":{"message":"API key GOOGLE-SECRET is invalid"}}',
    });
    const probes = createReadOnlyIntegrationProbes({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await probes.google({
      integration: "google",
      config: {
        apiKey: "GOOGLE-SECRET",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        model: undefined,
      },
      env: {},
    });

    expect(result.status).toBe("blocked");
    expect(result.evidence?.[0]?.target).toBe("https://generativelanguage.googleapis.com/v1beta/models");
    expect(JSON.stringify(result.evidence)).not.toContain("GOOGLE-SECRET");
  });
});
