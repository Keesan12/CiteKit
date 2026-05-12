import { z } from "zod";

import { sha256 } from "../utils/hash";

export type IntegrationReadinessStatus = "ready" | "missing" | "invalid" | "unverified" | "blocked";

export type IntegrationKey =
  | "supabase"
  | "github"
  | "stripe"
  | "webflow"
  | "wordpress"
  | "sentry"
  | "posthog"
  | "openai"
  | "anthropic"
  | "google"
  | "perplexity"
  | "openrouter";

export interface CredentialSnapshot {
  field: string;
  source: "config" | "env";
  present: boolean;
  maskedValue?: string;
}

export interface ProbeEvidence {
  kind: "http" | "command" | "policy";
  label: string;
  result: "pass" | "fail" | "blocked" | "error";
  detail: string;
  target?: string;
  statusCode?: number;
  exitCode?: number;
  excerpt?: string;
}

export interface IntegrationReadinessResult {
  integration: IntegrationKey;
  status: IntegrationReadinessStatus;
  summary: string;
  blockers: string[];
  verificationHints: string[];
  credentials: CredentialSnapshot[];
  metadata: Record<string, string | boolean | undefined>;
  probeAttempted: boolean;
  probeEvidence: ProbeEvidence[];
}

export interface IntegrationReadinessReport {
  status: IntegrationReadinessStatus;
  integrations: Record<IntegrationKey, IntegrationReadinessResult>;
}

export interface ProbeContext<TConfig> {
  integration: IntegrationKey;
  config: TConfig;
  env: Record<string, string | undefined>;
}

export type ProbeOutcome =
  | {
      status: "ready";
      summary?: string;
      evidence?: ProbeEvidence[];
    }
  | {
      status: "blocked" | "invalid" | "unverified";
      blockers: string[];
      summary?: string;
      evidence?: ProbeEvidence[];
    };

export type IntegrationProbe<TConfig> = (context: ProbeContext<TConfig>) => Promise<ProbeOutcome> | ProbeOutcome;

const NonEmptyStringSchema = z.string().trim().min(1);
const OptionalStringSchema = NonEmptyStringSchema.optional();
const OptionalHttpsUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), "Must use https").optional();
const EnvSchema = z.record(z.string(), z.string().optional()).default({});

const SupabaseConfigSchema = z
  .object({
    url: OptionalHttpsUrlSchema,
    anonKey: OptionalStringSchema,
    serviceRoleKey: OptionalStringSchema,
    accessToken: OptionalStringSchema,
    projectRef: OptionalStringSchema,
  })
  .strict();

const GitHubConfigSchema = z
  .object({
    token: OptionalStringSchema,
    appId: OptionalStringSchema,
    installationId: OptionalStringSchema,
    privateKey: OptionalStringSchema,
    owner: OptionalStringSchema,
    baseUrl: OptionalHttpsUrlSchema,
  })
  .strict();

const StripeConfigSchema = z
  .object({
    secretKey: OptionalStringSchema,
    publishableKey: OptionalStringSchema,
    webhookSecret: OptionalStringSchema,
  })
  .strict();

const WebflowConfigSchema = z
  .object({
    apiToken: OptionalStringSchema,
    siteId: OptionalStringSchema,
    collectionId: OptionalStringSchema,
    baseUrl: OptionalHttpsUrlSchema,
  })
  .strict();

const WordPressConfigSchema = z
  .object({
    baseUrl: OptionalHttpsUrlSchema,
    username: OptionalStringSchema,
    applicationPassword: OptionalStringSchema,
  })
  .strict();

const SentryConfigSchema = z
  .object({
    dsn: OptionalStringSchema,
    authToken: OptionalStringSchema,
    orgSlug: OptionalStringSchema,
    projectSlug: OptionalStringSchema,
    baseUrl: OptionalHttpsUrlSchema,
  })
  .strict();

const PostHogConfigSchema = z
  .object({
    host: OptionalHttpsUrlSchema,
    apiKey: OptionalStringSchema,
  })
  .strict();

const ProviderConfigSchema = z
  .object({
    apiKey: OptionalStringSchema,
    baseUrl: OptionalHttpsUrlSchema,
    model: OptionalStringSchema,
  })
  .strict();

const InputSchema = z
  .object({
    env: EnvSchema.optional(),
    config: z
      .object({
        supabase: SupabaseConfigSchema.optional(),
        github: GitHubConfigSchema.optional(),
        stripe: StripeConfigSchema.optional(),
        webflow: WebflowConfigSchema.optional(),
        wordpress: WordPressConfigSchema.optional(),
        sentry: SentryConfigSchema.optional(),
        posthog: PostHogConfigSchema.optional(),
        openai: ProviderConfigSchema.optional(),
        anthropic: ProviderConfigSchema.optional(),
        google: ProviderConfigSchema.optional(),
        perplexity: ProviderConfigSchema.optional(),
        openrouter: ProviderConfigSchema.optional(),
      })
      .strict()
      .optional(),
    probes: z
      .object({
        supabase: z.function().args(z.any()).returns(z.any()).optional(),
        github: z.function().args(z.any()).returns(z.any()).optional(),
        stripe: z.function().args(z.any()).returns(z.any()).optional(),
        webflow: z.function().args(z.any()).returns(z.any()).optional(),
        wordpress: z.function().args(z.any()).returns(z.any()).optional(),
        sentry: z.function().args(z.any()).returns(z.any()).optional(),
        posthog: z.function().args(z.any()).returns(z.any()).optional(),
        openai: z.function().args(z.any()).returns(z.any()).optional(),
        anthropic: z.function().args(z.any()).returns(z.any()).optional(),
        google: z.function().args(z.any()).returns(z.any()).optional(),
        perplexity: z.function().args(z.any()).returns(z.any()).optional(),
        openrouter: z.function().args(z.any()).returns(z.any()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

type ParsedInput = z.infer<typeof InputSchema>;

type OptionalProbeConfig<TKeys extends string> = Record<TKeys, string | undefined>;

interface ResolvedValue {
  field: string;
  source: "config" | "env";
  value: string;
}

const STATUS_ORDER: Record<IntegrationReadinessStatus, number> = {
  ready: 0,
  unverified: 1,
  missing: 2,
  blocked: 3,
  invalid: 4,
};

const PLACEHOLDER_VALUES = new Set([
  "changeme",
  "placeholder",
  "replace-me",
  "replace_me",
  "set-me",
  "set_me",
  "your-api-key",
  "your_api_key",
  "example",
  "example-key",
  "example_token",
  "test",
]);

export async function checkIntegrationReadiness(input: unknown): Promise<IntegrationReadinessReport> {
  const parsed = InputSchema.parse(input) as ParsedInput;
  const env = parsed.env ?? {};
  const config = parsed.config ?? {};
  const probes = parsed.probes ?? {};

  const results = {
    supabase: await evaluateSupabase(config.supabase, env, probes.supabase),
    github: await evaluateGitHub(config.github, env, probes.github),
    stripe: await evaluateStripe(config.stripe, env, probes.stripe),
    webflow: await evaluateWebflow(config.webflow, env, probes.webflow),
    wordpress: await evaluateWordPress(config.wordpress, env, probes.wordpress),
    sentry: await evaluateSentry(config.sentry, env, probes.sentry),
    posthog: await evaluatePostHog(config.posthog, env, probes.posthog),
    openai: await evaluateProvider("openai", config.openai, env, probes.openai),
    anthropic: await evaluateProvider("anthropic", config.anthropic, env, probes.anthropic),
    google: await evaluateProvider("google", config.google, env, probes.google),
    perplexity: await evaluateProvider("perplexity", config.perplexity, env, probes.perplexity),
    openrouter: await evaluateProvider("openrouter", config.openrouter, env, probes.openrouter),
  } satisfies Record<IntegrationKey, IntegrationReadinessResult>;

  const status = Object.values(results).reduce(
    (current: IntegrationReadinessStatus, result: IntegrationReadinessResult) =>
      STATUS_ORDER[result.status] > STATUS_ORDER[current] ? result.status : current,
    "ready" as IntegrationReadinessStatus,
  );

  return {
    status,
    integrations: results,
  };
}

function resolveValue(
  configValue: string | undefined,
  env: Record<string, string | undefined>,
  field: string,
  envKeys: string[],
): ResolvedValue | undefined {
  if (configValue) {
    return {
      field,
      source: "config",
      value: configValue,
    };
  }

  for (const envKey of envKeys) {
    const candidate = env[envKey];
    if (candidate) {
      return {
        field,
        source: "env",
        value: candidate,
      };
    }
  }

  return undefined;
}

function snapshotField(field: string, value: ResolvedValue | undefined): CredentialSnapshot {
  if (!value) {
    return {
      field,
      source: "env",
      present: false,
    };
  }

  return {
    field,
    source: value.source,
    present: true,
    maskedValue: maskSecret(value.value),
  };
}

function maskSecret(value: string): string {
  const fingerprint = sha256(value).slice(0, 10);
  return `[masked:${fingerprint}]`;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function isLikelyJwt(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part) && part.length > 0);
}

function decodeJwtPayload(value: string): Record<string, unknown> | null {
  if (!isLikelyJwt(value)) {
    return null;
  }

  const payload = value.split(".")[1];
  if (!payload) {
    return null;
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

function isPemPrivateKey(value: string): boolean {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+-----END [A-Z ]*PRIVATE KEY-----/.test(value);
}

function validUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildResult(
  integration: IntegrationKey,
  status: IntegrationReadinessStatus,
  summary: string,
  blockers: string[],
  verificationHints: string[],
  credentials: CredentialSnapshot[],
  metadata: Record<string, string | boolean | undefined>,
  probeAttempted = false,
  probeEvidence: ProbeEvidence[] = [],
): IntegrationReadinessResult {
  return {
    integration,
    status,
    summary,
    blockers,
    verificationHints,
    credentials,
    metadata,
    probeAttempted,
    probeEvidence,
  };
}

async function maybeProbe<TConfig>(
  integration: IntegrationKey,
  baseResult: IntegrationReadinessResult,
  probe: IntegrationProbe<TConfig> | undefined,
  config: TConfig,
  env: Record<string, string | undefined>,
): Promise<IntegrationReadinessResult> {
  if (!probe) {
    return baseResult;
  }

  const outcome = await probe({ integration, config, env });

  if (outcome.status === "ready") {
    return {
      ...baseResult,
      status: "ready",
      summary: outcome.summary ?? `${titleCase(integration)} credentials passed a caller-supplied probe.`,
      blockers: [],
      probeAttempted: true,
      probeEvidence: outcome.evidence ?? baseResult.probeEvidence,
    };
  }

  return {
    ...baseResult,
    status: outcome.status,
    summary:
      outcome.summary ?? `${titleCase(integration)} credentials were present, but the caller-supplied probe did not pass.`,
    blockers: outcome.blockers,
    probeAttempted: true,
    probeEvidence: outcome.evidence ?? baseResult.probeEvidence,
  };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function evaluateSupabase(
  input: z.infer<typeof SupabaseConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"url" | "anonKey" | "serviceRoleKey" | "accessToken" | "projectRef">> | undefined,
): Promise<IntegrationReadinessResult> {
  const url = resolveValue(input?.url, env, "SUPABASE_URL", ["SUPABASE_URL"]);
  const anonKey = resolveValue(input?.anonKey, env, "SUPABASE_ANON_KEY", ["SUPABASE_ANON_KEY"]);
  const serviceRoleKey = resolveValue(input?.serviceRoleKey, env, "SUPABASE_SERVICE_ROLE_KEY", ["SUPABASE_SERVICE_ROLE_KEY"]);
  const accessToken = resolveValue(input?.accessToken, env, "SUPABASE_ACCESS_TOKEN", ["SUPABASE_ACCESS_TOKEN"]);
  const projectRef = resolveValue(input?.projectRef, env, "SUPABASE_PROJECT_REF", ["SUPABASE_PROJECT_REF"]);

  const credentials = [
    snapshotField("SUPABASE_URL", url),
    snapshotField("SUPABASE_ANON_KEY", anonKey),
    snapshotField("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey),
    snapshotField("SUPABASE_ACCESS_TOKEN", accessToken),
    snapshotField("SUPABASE_PROJECT_REF", projectRef),
  ];

  const blockers: string[] = [];

  if (!url) {
    blockers.push("Missing SUPABASE_URL.");
  } else if (!validUrl(url.value)) {
    blockers.push("SUPABASE_URL must be a valid https URL.");
  }

  if (!serviceRoleKey && !anonKey) {
    blockers.push("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.");
  }

  if (serviceRoleKey) {
    if (isPlaceholder(serviceRoleKey.value) || !isLikelyJwt(serviceRoleKey.value)) {
      blockers.push("SUPABASE_SERVICE_ROLE_KEY must be a non-placeholder JWT.");
    } else {
      const payload = decodeJwtPayload(serviceRoleKey.value);
      const role = typeof payload?.role === "string" ? payload.role : undefined;
      if (role && role !== "service_role") {
        blockers.push(`SUPABASE_SERVICE_ROLE_KEY decoded with role "${role}", expected "service_role".`);
      }
    }
  }

  if (anonKey) {
    if (isPlaceholder(anonKey.value) || !isLikelyJwt(anonKey.value)) {
      blockers.push("SUPABASE_ANON_KEY must be a non-placeholder JWT.");
    } else {
      const payload = decodeJwtPayload(anonKey.value);
      const role = typeof payload?.role === "string" ? payload.role : undefined;
      if (role && role !== "anon") {
        blockers.push(`SUPABASE_ANON_KEY decoded with role "${role}", expected "anon".`);
      }
    }
  }

  if (accessToken && (isPlaceholder(accessToken.value) || hasWhitespace(accessToken.value) || accessToken.value.length < 20)) {
    blockers.push("SUPABASE_ACCESS_TOKEN must be a non-placeholder token without whitespace.");
  }

  if (projectRef && !/^[a-z0-9]{6,}$/i.test(projectRef.value)) {
    blockers.push("SUPABASE_PROJECT_REF must be an alphanumeric project reference.");
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be") || blocker.includes("decoded"));
    return buildResult(
      "supabase",
      invalid ? "invalid" : "missing",
      invalid
        ? "Supabase configuration is present but malformed."
        : "Supabase is missing runtime credentials required for production use.",
      blockers,
      ["supabase projects list", "Pass a probe function that performs a read-only Supabase health query."],
      credentials,
      {
        urlConfigured: Boolean(url),
        hasAnonKey: Boolean(anonKey),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasAccessToken: Boolean(accessToken),
        hasProjectRef: Boolean(projectRef),
      },
    );
  }

  if (!serviceRoleKey) {
    return buildResult(
      "supabase",
      "blocked",
      "Supabase has a public anon key, but server-side production readiness is blocked without a service-role key.",
      ["Only SUPABASE_ANON_KEY is configured; add SUPABASE_SERVICE_ROLE_KEY for server-side production flows."],
      ["supabase projects list", "Pass a probe function that performs a read-only Supabase health query."],
      credentials,
      {
        urlConfigured: true,
        hasAnonKey: true,
        hasServiceRoleKey: false,
        hasAccessToken: Boolean(accessToken),
        hasProjectRef: Boolean(projectRef),
      },
    );
  }

  if (!url) {
    throw new Error("SUPABASE_URL passed validation but was not resolved.");
  }

  const verifiedUrl = url.value;
  const verifiedServiceRoleKey = serviceRoleKey.value;

  return maybeProbe(
    "supabase",
    buildResult(
      "supabase",
      "unverified",
      "Supabase runtime credentials are present and structurally valid, but no live probe has run yet.",
      ["Supabase credentials have not been live-verified by a caller-supplied probe."],
      ["supabase projects list", "Pass a probe function that performs a read-only Supabase health query."],
      credentials,
      {
        urlConfigured: true,
        hasAnonKey: Boolean(anonKey),
        hasServiceRoleKey: true,
        hasAccessToken: Boolean(accessToken),
        hasProjectRef: Boolean(projectRef),
      },
    ),
    probe,
    {
      url: verifiedUrl,
      anonKey: anonKey?.value,
      serviceRoleKey: verifiedServiceRoleKey,
      accessToken: accessToken?.value,
      projectRef: projectRef?.value,
    },
    env,
  );
}

async function evaluateGitHub(
  input: z.infer<typeof GitHubConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<
    OptionalProbeConfig<"token" | "appId" | "installationId" | "privateKey" | "owner" | "baseUrl">
  > | undefined,
): Promise<IntegrationReadinessResult> {
  const token = resolveValue(input?.token, env, "GITHUB_TOKEN", ["GITHUB_TOKEN", "GH_TOKEN"]);
  const appId = resolveValue(input?.appId, env, "GITHUB_APP_ID", ["GITHUB_APP_ID"]);
  const installationId = resolveValue(input?.installationId, env, "GITHUB_APP_INSTALLATION_ID", ["GITHUB_APP_INSTALLATION_ID"]);
  const privateKey = resolveValue(input?.privateKey, env, "GITHUB_APP_PRIVATE_KEY", ["GITHUB_APP_PRIVATE_KEY"]);
  const owner = resolveValue(input?.owner, env, "GITHUB_OWNER", ["GITHUB_OWNER", "GITHUB_REPOSITORY_OWNER"]);
  const baseUrl = resolveValue(input?.baseUrl, env, "GITHUB_API_URL", ["GITHUB_API_URL"]);

  const credentials = [
    snapshotField("GITHUB_TOKEN", token),
    snapshotField("GITHUB_APP_ID", appId),
    snapshotField("GITHUB_APP_INSTALLATION_ID", installationId),
    snapshotField("GITHUB_APP_PRIVATE_KEY", privateKey),
    snapshotField("GITHUB_OWNER", owner),
    snapshotField("GITHUB_API_URL", baseUrl),
  ];

  const blockers: string[] = [];
  const hasAppTuple = Boolean(appId || installationId || privateKey);

  if (baseUrl && !validUrl(baseUrl.value)) {
    blockers.push("GITHUB_API_URL must be a valid https URL.");
  }

  if (token) {
    if (
      isPlaceholder(token.value) ||
      hasWhitespace(token.value) ||
      !/^(gh[pousr]_|github_pat_)/.test(token.value)
    ) {
      blockers.push("GITHUB_TOKEN must be a non-placeholder GitHub token.");
    }
  }

  if (hasAppTuple) {
    if (!appId) {
      blockers.push("Missing GITHUB_APP_ID.");
    } else if (!isNumericId(appId.value)) {
      blockers.push("GITHUB_APP_ID must be a numeric string.");
    }

    if (!installationId) {
      blockers.push("Missing GITHUB_APP_INSTALLATION_ID.");
    } else if (!isNumericId(installationId.value)) {
      blockers.push("GITHUB_APP_INSTALLATION_ID must be a numeric string.");
    }

    if (!privateKey) {
      blockers.push("Missing GITHUB_APP_PRIVATE_KEY.");
    } else if (isPlaceholder(privateKey.value) || !isPemPrivateKey(privateKey.value)) {
      blockers.push("GITHUB_APP_PRIVATE_KEY must be a PEM-encoded private key.");
    }
  }

  if (!token && !hasAppTuple) {
    blockers.push("Missing GITHUB_TOKEN or the full GitHub App credential tuple.");
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be"));
    return buildResult(
      "github",
      invalid ? "invalid" : "missing",
      invalid ? "GitHub credentials are present but malformed." : "GitHub is missing token or app credentials.",
      blockers,
      ["gh auth status", "Pass a probe function that performs a read-only GitHub identity check."],
      credentials,
      {
        hasToken: Boolean(token),
        hasAppTuple,
        hasOwner: Boolean(owner),
        baseUrlConfigured: Boolean(baseUrl),
      },
    );
  }

  return maybeProbe(
    "github",
    buildResult(
      "github",
      "unverified",
      "GitHub credentials are present and structurally valid, but no live probe has run yet.",
      ["GitHub credentials have not been live-verified by a caller-supplied probe."],
      ["gh auth status", "Pass a probe function that performs a read-only GitHub identity check."],
      credentials,
      {
        hasToken: Boolean(token),
        hasAppTuple,
        hasOwner: Boolean(owner),
        baseUrlConfigured: Boolean(baseUrl),
      },
    ),
    probe,
    {
      token: token?.value,
      appId: appId?.value,
      installationId: installationId?.value,
      privateKey: privateKey?.value,
      owner: owner?.value,
      baseUrl: baseUrl?.value,
    },
    env,
  );
}

async function evaluateStripe(
  input: z.infer<typeof StripeConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"secretKey" | "publishableKey" | "webhookSecret">> | undefined,
): Promise<IntegrationReadinessResult> {
  const secretKey = resolveValue(input?.secretKey, env, "STRIPE_SECRET_KEY", ["STRIPE_SECRET_KEY"]);
  const publishableKey = resolveValue(input?.publishableKey, env, "STRIPE_PUBLISHABLE_KEY", ["STRIPE_PUBLISHABLE_KEY"]);
  const webhookSecret = resolveValue(input?.webhookSecret, env, "STRIPE_WEBHOOK_SECRET", ["STRIPE_WEBHOOK_SECRET"]);

  const credentials = [
    snapshotField("STRIPE_SECRET_KEY", secretKey),
    snapshotField("STRIPE_PUBLISHABLE_KEY", publishableKey),
    snapshotField("STRIPE_WEBHOOK_SECRET", webhookSecret),
  ];

  const blockers: string[] = [];

  if (!secretKey) {
    blockers.push("Missing STRIPE_SECRET_KEY.");
  } else if (isPlaceholder(secretKey.value) || hasWhitespace(secretKey.value) || !/^(sk|rk)_(live|test)_/.test(secretKey.value)) {
    blockers.push("STRIPE_SECRET_KEY must be a Stripe secret or restricted key.");
  }

  if (publishableKey && (isPlaceholder(publishableKey.value) || hasWhitespace(publishableKey.value) || !/^pk_(live|test)_/.test(publishableKey.value))) {
    blockers.push("STRIPE_PUBLISHABLE_KEY must be a Stripe publishable key.");
  }

  if (webhookSecret && (isPlaceholder(webhookSecret.value) || hasWhitespace(webhookSecret.value) || !/^whsec_/.test(webhookSecret.value))) {
    blockers.push("STRIPE_WEBHOOK_SECRET must be a Stripe webhook secret.");
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be"));
    return buildResult(
      "stripe",
      invalid ? "invalid" : "missing",
      invalid ? "Stripe credentials are present but malformed." : "Stripe is missing a secret key.",
      blockers,
      ["stripe config --list", "Pass a probe function that performs a read-only Stripe account lookup."],
      credentials,
      {
        hasSecretKey: Boolean(secretKey),
        hasPublishableKey: Boolean(publishableKey),
        hasWebhookSecret: Boolean(webhookSecret),
      },
    );
  }

  if (secretKey && /_(test)_/.test(secretKey.value)) {
    return buildResult(
      "stripe",
      "blocked",
      "Stripe is configured with a test-mode key, which is not production-ready.",
      ["STRIPE_SECRET_KEY is a test-mode key; replace it with a live secret or restricted key for production."],
      ["stripe config --list", "Pass a probe function that performs a read-only Stripe account lookup."],
      credentials,
      {
        hasSecretKey: true,
        hasPublishableKey: Boolean(publishableKey),
        hasWebhookSecret: Boolean(webhookSecret),
        mode: "test",
      },
    );
  }

  return maybeProbe(
    "stripe",
    buildResult(
      "stripe",
      "unverified",
      "Stripe credentials are present and structurally valid, but no live probe has run yet.",
      ["Stripe credentials have not been live-verified by a caller-supplied probe."],
      ["stripe config --list", "Pass a probe function that performs a read-only Stripe account lookup."],
      credentials,
      {
        hasSecretKey: true,
        hasPublishableKey: Boolean(publishableKey),
        hasWebhookSecret: Boolean(webhookSecret),
        mode: "live",
      },
    ),
    probe,
    {
      secretKey: secretKey?.value,
      publishableKey: publishableKey?.value,
      webhookSecret: webhookSecret?.value,
    },
    env,
  );
}

async function evaluateWebflow(
  input: z.infer<typeof WebflowConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"apiToken" | "siteId" | "collectionId" | "baseUrl">> | undefined,
): Promise<IntegrationReadinessResult> {
  const apiToken = resolveValue(input?.apiToken, env, "WEBFLOW_API_TOKEN", ["WEBFLOW_API_TOKEN"]);
  const siteId = resolveValue(input?.siteId, env, "WEBFLOW_SITE_ID", ["WEBFLOW_SITE_ID"]);
  const collectionId = resolveValue(input?.collectionId, env, "WEBFLOW_COLLECTION_ID", ["WEBFLOW_COLLECTION_ID"]);
  const baseUrl = resolveValue(input?.baseUrl, env, "WEBFLOW_API_URL", ["WEBFLOW_API_URL"]);

  const credentials = [
    snapshotField("WEBFLOW_API_TOKEN", apiToken),
    snapshotField("WEBFLOW_SITE_ID", siteId),
    snapshotField("WEBFLOW_COLLECTION_ID", collectionId),
    snapshotField("WEBFLOW_API_URL", baseUrl),
  ];

  const blockers: string[] = [];

  if (!apiToken) {
    blockers.push("Missing WEBFLOW_API_TOKEN.");
  } else if (isPlaceholder(apiToken.value) || hasWhitespace(apiToken.value) || apiToken.value.length < 20) {
    blockers.push("WEBFLOW_API_TOKEN must be a non-placeholder token without whitespace.");
  }

  if (!siteId) {
    blockers.push("Missing WEBFLOW_SITE_ID.");
  }

  if (baseUrl && !validUrl(baseUrl.value)) {
    blockers.push("WEBFLOW_API_URL must be a valid https URL.");
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be"));
    return buildResult(
      "webflow",
      invalid ? "invalid" : "missing",
      invalid ? "Webflow credentials are present but malformed." : "Webflow is missing the token or site identifier required for CMS use.",
      blockers,
      ['curl -sS -H "Authorization: Bearer $WEBFLOW_API_TOKEN" https://api.webflow.com/v2/sites', "Pass a probe function that performs a read-only Webflow site lookup."],
      credentials,
      {
        hasApiToken: Boolean(apiToken),
        hasSiteId: Boolean(siteId),
        hasCollectionId: Boolean(collectionId),
        baseUrlConfigured: Boolean(baseUrl),
      },
    );
  }

  return maybeProbe(
    "webflow",
    buildResult(
      "webflow",
      "unverified",
      "Webflow credentials are present and structurally valid, but no live probe has run yet.",
      ["Webflow credentials have not been live-verified by a caller-supplied probe."],
      ['curl -sS -H "Authorization: Bearer $WEBFLOW_API_TOKEN" https://api.webflow.com/v2/sites', "Pass a probe function that performs a read-only Webflow site lookup."],
      credentials,
      {
        hasApiToken: true,
        hasSiteId: true,
        hasCollectionId: Boolean(collectionId),
        baseUrlConfigured: Boolean(baseUrl),
      },
    ),
    probe,
    {
      apiToken: apiToken?.value,
      siteId: siteId?.value,
      collectionId: collectionId?.value,
      baseUrl: baseUrl?.value,
    },
    env,
  );
}

async function evaluateWordPress(
  input: z.infer<typeof WordPressConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"baseUrl" | "username" | "applicationPassword">> | undefined,
): Promise<IntegrationReadinessResult> {
  const baseUrl = resolveValue(input?.baseUrl, env, "WORDPRESS_BASE_URL", ["WORDPRESS_BASE_URL"]);
  const username = resolveValue(input?.username, env, "WORDPRESS_USERNAME", ["WORDPRESS_USERNAME"]);
  const applicationPassword = resolveValue(
    input?.applicationPassword,
    env,
    "WORDPRESS_APPLICATION_PASSWORD",
    ["WORDPRESS_APPLICATION_PASSWORD"],
  );

  const credentials = [
    snapshotField("WORDPRESS_BASE_URL", baseUrl),
    snapshotField("WORDPRESS_USERNAME", username),
    snapshotField("WORDPRESS_APPLICATION_PASSWORD", applicationPassword),
  ];

  const blockers: string[] = [];

  if (!baseUrl) {
    blockers.push("Missing WORDPRESS_BASE_URL.");
  } else if (!validUrl(baseUrl.value)) {
    blockers.push("WORDPRESS_BASE_URL must be a valid https URL.");
  }

  if (!username) {
    blockers.push("Missing WORDPRESS_USERNAME.");
  }

  if (!applicationPassword) {
    blockers.push("Missing WORDPRESS_APPLICATION_PASSWORD.");
  } else {
    const normalized = applicationPassword.value.replace(/\s+/g, "");
    if (isPlaceholder(applicationPassword.value) || hasWhitespace(normalized) || normalized.length < 24 || !/^[A-Za-z0-9]+$/.test(normalized)) {
      blockers.push("WORDPRESS_APPLICATION_PASSWORD must look like a WordPress application password.");
    }
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be") || blocker.includes("must look"));
    return buildResult(
      "wordpress",
      invalid ? "invalid" : "missing",
      invalid ? "WordPress credentials are present but malformed." : "WordPress is missing the URL or credentials required for authenticated publishing.",
      blockers,
      ['curl -sS "$WORDPRESS_BASE_URL/wp-json/"', "Pass a probe function that performs a read-only WordPress REST authentication check."],
      credentials,
      {
        hasBaseUrl: Boolean(baseUrl),
        hasUsername: Boolean(username),
        hasApplicationPassword: Boolean(applicationPassword),
      },
    );
  }

  return maybeProbe(
    "wordpress",
    buildResult(
      "wordpress",
      "unverified",
      "WordPress credentials are present and structurally valid, but no live probe has run yet.",
      ["WordPress credentials have not been live-verified by a caller-supplied probe."],
      ['curl -sS "$WORDPRESS_BASE_URL/wp-json/"', "Pass a probe function that performs a read-only WordPress REST authentication check."],
      credentials,
      {
        hasBaseUrl: true,
        hasUsername: true,
        hasApplicationPassword: true,
      },
    ),
    probe,
    {
      baseUrl: baseUrl?.value,
      username: username?.value,
      applicationPassword: applicationPassword?.value,
    },
    env,
  );
}

async function evaluateSentry(
  input: z.infer<typeof SentryConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"dsn" | "authToken" | "orgSlug" | "projectSlug" | "baseUrl">> | undefined,
): Promise<IntegrationReadinessResult> {
  const dsn = resolveValue(input?.dsn, env, "SENTRY_DSN", ["SENTRY_DSN"]);
  const authToken = resolveValue(input?.authToken, env, "SENTRY_AUTH_TOKEN", ["SENTRY_AUTH_TOKEN"]);
  const orgSlug = resolveValue(input?.orgSlug, env, "SENTRY_ORG", ["SENTRY_ORG", "SENTRY_ORG_SLUG"]);
  const projectSlug = resolveValue(input?.projectSlug, env, "SENTRY_PROJECT", ["SENTRY_PROJECT", "SENTRY_PROJECT_SLUG"]);
  const baseUrl = resolveValue(input?.baseUrl, env, "SENTRY_BASE_URL", ["SENTRY_BASE_URL"]);

  const credentials = [
    snapshotField("SENTRY_DSN", dsn),
    snapshotField("SENTRY_AUTH_TOKEN", authToken),
    snapshotField("SENTRY_ORG", orgSlug),
    snapshotField("SENTRY_PROJECT", projectSlug),
    snapshotField("SENTRY_BASE_URL", baseUrl),
  ];

  const blockers: string[] = [];

  if (!dsn) {
    blockers.push("Missing SENTRY_DSN.");
  } else if (!/^https:\/\/[^@]+@[^/]+\/\d+/.test(dsn.value)) {
    blockers.push("SENTRY_DSN must be a valid Sentry DSN.");
  }

  if (authToken && (isPlaceholder(authToken.value) || hasWhitespace(authToken.value) || authToken.value.length < 20)) {
    blockers.push("SENTRY_AUTH_TOKEN must be a non-placeholder token without whitespace.");
  }

  if (baseUrl && !validUrl(baseUrl.value)) {
    blockers.push("SENTRY_BASE_URL must be a valid https URL.");
  }

  if ((orgSlug && !authToken) || (projectSlug && !authToken)) {
    blockers.push("SENTRY_AUTH_TOKEN is required when SENTRY_ORG or SENTRY_PROJECT is configured.");
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be"));
    return buildResult(
      "sentry",
      invalid ? "invalid" : "missing",
      invalid ? "Sentry credentials are present but malformed." : "Sentry is missing the DSN or supporting auth token required by the supplied config.",
      blockers,
      ["sentry-cli info", "Pass a probe function that performs a read-only Sentry project lookup."],
      credentials,
      {
        hasDsn: Boolean(dsn),
        hasAuthToken: Boolean(authToken),
        hasOrgSlug: Boolean(orgSlug),
        hasProjectSlug: Boolean(projectSlug),
        baseUrlConfigured: Boolean(baseUrl),
      },
    );
  }

  return maybeProbe(
    "sentry",
    buildResult(
      "sentry",
      "unverified",
      "Sentry credentials are present and structurally valid, but no live probe has run yet.",
      ["Sentry credentials have not been live-verified by a caller-supplied probe."],
      ["sentry-cli info", "Pass a probe function that performs a read-only Sentry project lookup."],
      credentials,
      {
        hasDsn: true,
        hasAuthToken: Boolean(authToken),
        hasOrgSlug: Boolean(orgSlug),
        hasProjectSlug: Boolean(projectSlug),
        baseUrlConfigured: Boolean(baseUrl),
      },
    ),
    probe,
    {
      dsn: dsn?.value,
      authToken: authToken?.value,
      orgSlug: orgSlug?.value,
      projectSlug: projectSlug?.value,
      baseUrl: baseUrl?.value,
    },
    env,
  );
}

async function evaluatePostHog(
  input: z.infer<typeof PostHogConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"host" | "apiKey">> | undefined,
): Promise<IntegrationReadinessResult> {
  const host = resolveValue(input?.host, env, "POSTHOG_HOST", ["POSTHOG_HOST"]);
  const apiKey = resolveValue(input?.apiKey, env, "POSTHOG_API_KEY", ["POSTHOG_API_KEY"]);

  const credentials = [snapshotField("POSTHOG_HOST", host), snapshotField("POSTHOG_API_KEY", apiKey)];
  const blockers: string[] = [];

  if (!host) {
    blockers.push("Missing POSTHOG_HOST.");
  } else if (!validUrl(host.value)) {
    blockers.push("POSTHOG_HOST must be a valid https URL.");
  }

  if (!apiKey) {
    blockers.push("Missing POSTHOG_API_KEY.");
  } else if (isPlaceholder(apiKey.value) || hasWhitespace(apiKey.value) || apiKey.value.length < 20) {
    blockers.push("POSTHOG_API_KEY must be a non-placeholder token without whitespace.");
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must be"));
    return buildResult(
      "posthog",
      invalid ? "invalid" : "missing",
      invalid ? "PostHog credentials are present but malformed." : "PostHog is missing the host or API key required for ingestion.",
      blockers,
      ["Pass a probe function that performs a read-only PostHog project or identity check."],
      credentials,
      {
        hasHost: Boolean(host),
        hasApiKey: Boolean(apiKey),
      },
    );
  }

  return maybeProbe(
    "posthog",
    buildResult(
      "posthog",
      "unverified",
      "PostHog credentials are present and structurally valid, but no live probe has run yet.",
      ["PostHog credentials have not been live-verified by a caller-supplied probe."],
      ["Pass a probe function that performs a read-only PostHog project or identity check."],
      credentials,
      {
        hasHost: true,
        hasApiKey: true,
      },
    ),
    probe,
    {
      host: host?.value,
      apiKey: apiKey?.value,
    },
    env,
  );
}

const PROVIDER_ENV_KEYS: Record<Exclude<IntegrationKey, "supabase" | "github" | "stripe" | "webflow" | "wordpress" | "sentry" | "posthog">, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const PROVIDER_MODEL_ENV_KEYS: Partial<Record<Exclude<IntegrationKey, "supabase" | "github" | "stripe" | "webflow" | "wordpress" | "sentry" | "posthog">, string>> = {
  openai: "OPENAI_PROBE_MODEL",
  anthropic: "ANTHROPIC_PROBE_MODEL",
  google: "GOOGLE_PROBE_MODEL",
  perplexity: "PERPLEXITY_PROBE_MODEL",
  openrouter: "OPENROUTER_PROBE_MODEL",
};

function validateProviderKey(integration: IntegrationKey, value: string): string | null {
  if (isPlaceholder(value) || hasWhitespace(value)) {
    return `${titleCase(integration)} API key must be a non-placeholder token without whitespace.`;
  }

  switch (integration) {
    case "openai":
      return /^sk-/.test(value) ? null : "OpenAI API key must start with \"sk-\".";
    case "anthropic":
      return /^sk-ant-/.test(value) ? null : "Anthropic API key must start with \"sk-ant-\".";
    case "google":
      return /^AIza[0-9A-Za-z_-]{10,}$/.test(value) ? null : "Google API key must start with \"AIza\".";
    case "perplexity":
      return /^pplx-/.test(value) ? null : "Perplexity API key must start with \"pplx-\".";
    case "openrouter":
      return /^sk-or-v1-/.test(value) ? null : "OpenRouter API key must start with \"sk-or-v1-\".";
    default:
      return null;
  }
}

async function evaluateProvider(
  integration: Exclude<IntegrationKey, "supabase" | "github" | "stripe" | "webflow" | "wordpress" | "sentry" | "posthog">,
  input: z.infer<typeof ProviderConfigSchema> | undefined,
  env: Record<string, string | undefined>,
  probe: IntegrationProbe<OptionalProbeConfig<"apiKey" | "baseUrl" | "model">> | undefined,
): Promise<IntegrationReadinessResult> {
  const apiKeyField = PROVIDER_ENV_KEYS[integration];
  const modelField = PROVIDER_MODEL_ENV_KEYS[integration];
  const baseUrlField = `${integration.toUpperCase()}_BASE_URL`;

  const apiKey = resolveValue(input?.apiKey, env, apiKeyField, [apiKeyField]);
  const baseUrl = resolveValue(input?.baseUrl, env, baseUrlField, [baseUrlField]);
  const model = modelField ? resolveValue(input?.model, env, modelField, [modelField]) : undefined;

  const credentials = [
    snapshotField(apiKeyField, apiKey),
    snapshotField(baseUrlField, baseUrl),
    snapshotField(modelField ?? `${integration.toUpperCase()}_MODEL`, model),
  ];

  const blockers: string[] = [];

  if (!apiKey) {
    blockers.push(`Missing ${apiKeyField}.`);
  } else {
    const error = validateProviderKey(integration, apiKey.value);
    if (error) {
      blockers.push(error);
    }
  }

  if (baseUrl && !validUrl(baseUrl.value)) {
    blockers.push(`${baseUrlField} must be a valid https URL.`);
  }

  if (model && isPlaceholder(model.value)) {
    blockers.push(`${model.field} must not be a placeholder value.`);
  }

  if (blockers.length > 0) {
    const invalid = blockers.some((blocker) => blocker.includes("must"));
    return buildResult(
      integration,
      invalid ? "invalid" : "missing",
      invalid ? `${titleCase(integration)} credentials are present but malformed.` : `${titleCase(integration)} is missing an API key.`,
      blockers,
      [`Pass a probe function that performs a read-only ${titleCase(integration)} model or identity lookup.`],
      credentials,
      {
        hasApiKey: Boolean(apiKey),
        hasBaseUrl: Boolean(baseUrl),
        hasModel: Boolean(model),
      },
    );
  }

  return maybeProbe(
    integration,
    buildResult(
      integration,
      "unverified",
      `${titleCase(integration)} credentials are present and structurally valid, but no live probe has run yet.`,
      [`${titleCase(integration)} credentials have not been live-verified by a caller-supplied probe.`],
      [`Pass a probe function that performs a read-only ${titleCase(integration)} model or identity lookup.`],
      credentials,
      {
        hasApiKey: true,
        hasBaseUrl: Boolean(baseUrl),
        hasModel: Boolean(model),
      },
    ),
    probe,
    {
      apiKey: apiKey?.value,
      baseUrl: baseUrl?.value,
      model: model?.value,
    },
    env,
  );
}
