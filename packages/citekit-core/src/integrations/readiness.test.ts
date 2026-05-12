import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { ProbeContext } from "./readiness";
import { checkIntegrationReadiness } from "./readiness";

function makeJwt(role: "anon" | "service_role"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url");
  return `${header}.${payload}.signature`;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((entry) => collectStrings(entry));
  }

  return [];
}

describe("integration readiness", () => {
  it("classifies missing credentials without leaking secrets", async () => {
    const report = await checkIntegrationReadiness({
      env: {},
    });

    expect(report.integrations.supabase.status).toBe("missing");
    expect(report.integrations.github.status).toBe("missing");
    expect(report.integrations.openai.status).toBe("missing");
    expect(report.integrations.supabase.blockers).toContain("Missing SUPABASE_URL.");
    expect(report.integrations.openai.blockers).toContain("Missing OPENAI_API_KEY.");
  });

  it("classifies malformed provider credentials as invalid", async () => {
    const report = await checkIntegrationReadiness({
      env: {
        OPENAI_API_KEY: "not-a-real-openai-key",
        STRIPE_SECRET_KEY: "bad-stripe-key",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "not-a-jwt",
      },
    });

    expect(report.integrations.openai.status).toBe("invalid");
    expect(report.integrations.stripe.status).toBe("invalid");
    expect(report.integrations.supabase.status).toBe("invalid");
    expect(report.integrations.openai.blockers).toContain('OpenAI API key must start with "sk-".');
    expect(report.integrations.stripe.blockers).toContain("STRIPE_SECRET_KEY must be a Stripe secret or restricted key.");
    expect(report.integrations.supabase.blockers).toContain("SUPABASE_SERVICE_ROLE_KEY must be a non-placeholder JWT.");
  });

  it("classifies structurally valid credentials as unverified until a probe passes", async () => {
    const report = await checkIntegrationReadiness({
      env: {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: makeJwt("service_role"),
        SUPABASE_ANON_KEY: makeJwt("anon"),
        GITHUB_TOKEN: "ghp_fixture",
        STRIPE_SECRET_KEY: "rk_live_fixture",
        WEBFLOW_API_TOKEN: "wf_1234567890abcdefghijklmnopqrstuvwxyz",
        WEBFLOW_SITE_ID: "site_123456",
        WORDPRESS_BASE_URL: "https://example.com",
        WORDPRESS_USERNAME: "editor",
        WORDPRESS_APPLICATION_PASSWORD: "abcd efgh ijkl mnop qrst uvwx",
        SENTRY_DSN: "https://public@example.ingest.sentry.io/12345",
        POSTHOG_HOST: "https://us.i.posthog.com",
        POSTHOG_API_KEY: "phx_1234567890abcdefghijklmnopqrstuvwxyz",
        OPENAI_API_KEY: "sk-local",
        ANTHROPIC_API_KEY: "sk-ant-fixture",
        GOOGLE_API_KEY: "AIza1234567890abcdefghijklmnopqrst",
        PERPLEXITY_API_KEY: "pplx-fixture",
        OPENROUTER_API_KEY: "sk-or-v1-fixture",
      },
    });

    expect(report.integrations.supabase.status).toBe("unverified");
    expect(report.integrations.github.status).toBe("unverified");
    expect(report.integrations.stripe.status).toBe("unverified");
    expect(report.integrations.openai.status).toBe("unverified");
    expect(report.integrations.supabase.probeAttempted).toBe(false);
    expect(report.integrations.stripe.blockers).toContain(
      "Stripe credentials have not been live-verified by a caller-supplied probe.",
    );
  });

  it("upgrades to ready when a caller-supplied probe passes", async () => {
    const report = await checkIntegrationReadiness({
      env: {
        OPENAI_API_KEY: "sk-local",
      },
      probes: {
        openai: ({ config }: ProbeContext<{ apiKey: string | undefined; baseUrl: string | undefined; model: string | undefined }>) => ({
          status: "ready",
          summary: `Validated ${config.apiKey ? "OpenAI" : "missing"} probe`,
        }),
      },
    });

    expect(report.integrations.openai.status).toBe("ready");
    expect(report.integrations.openai.probeAttempted).toBe(true);
    expect(report.integrations.openai.summary).toBe("Validated OpenAI probe");
    expect(report.integrations.openai.blockers).toEqual([]);
    expect(report.integrations.openai.probeEvidence).toEqual([]);
  });

  it("classifies production blockers distinctly from missing or invalid states", async () => {
    const report = await checkIntegrationReadiness({
      env: {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: makeJwt("anon"),
        STRIPE_SECRET_KEY: "rk_test_fixture",
      },
    });

    expect(report.integrations.supabase.status).toBe("blocked");
    expect(report.integrations.stripe.status).toBe("blocked");
    expect(report.integrations.supabase.blockers).toContain(
      "Only SUPABASE_ANON_KEY is configured; add SUPABASE_SERVICE_ROLE_KEY for server-side production flows.",
    );
    expect(report.integrations.stripe.blockers).toContain(
      "STRIPE_SECRET_KEY is a test-mode key; replace it with a live secret or restricted key for production.",
    );
  });

  it("never emits raw secrets anywhere in the report payload", async () => {
    const secrets = {
      SUPABASE_SERVICE_ROLE_KEY: makeJwt("service_role"),
      GITHUB_TOKEN: "ghp_fixture_secret",
      STRIPE_SECRET_KEY: "rk_live_fixture_secret",
      OPENAI_API_KEY: "sk-fixture-secret",
    };

    const report = await checkIntegrationReadiness({
      env: {
        SUPABASE_URL: "https://project.supabase.co",
        ...secrets,
      },
    });

    const serialized = JSON.stringify(report);
    const strings = collectStrings(report);

    for (const secret of Object.values(secrets)) {
      expect(serialized).not.toContain(secret);
      expect(strings).not.toContain(secret);
    }

    expect(report.integrations.openai.credentials[0]?.maskedValue).toMatch(/^\[masked:[a-f0-9]{10}\]$/);
    expect(report.integrations.github.credentials[0]?.maskedValue).toMatch(/^\[masked:[a-f0-9]{10}\]$/);
    expect(report.integrations.github.probeEvidence).toEqual([]);
  });

  it("fails fast when config shapes are invalid", async () => {
    await expect(
      checkIntegrationReadiness({
        config: {
          openai: {
            apiKey: 123,
          },
        },
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
