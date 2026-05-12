import type {
  IntegrationProbe,
  ProbeContext,
  ProbeEvidence,
  ProbeOutcome,
} from "./readiness";

export interface ReadOnlyIntegrationProbeOptions {
  fetchImpl?: typeof fetch;
}

type SupabaseProbeConfig = {
  url: string | undefined;
  anonKey: string | undefined;
  serviceRoleKey: string | undefined;
  accessToken: string | undefined;
  projectRef: string | undefined;
};

type GitHubProbeConfig = {
  token: string | undefined;
  appId: string | undefined;
  installationId: string | undefined;
  privateKey: string | undefined;
  owner: string | undefined;
  baseUrl: string | undefined;
};

type StripeProbeConfig = {
  secretKey: string | undefined;
  publishableKey: string | undefined;
  webhookSecret: string | undefined;
};

type WebflowProbeConfig = {
  apiToken: string | undefined;
  siteId: string | undefined;
  collectionId: string | undefined;
  baseUrl: string | undefined;
};

type WordPressProbeConfig = {
  baseUrl: string | undefined;
  username: string | undefined;
  applicationPassword: string | undefined;
};

type SentryProbeConfig = {
  dsn: string | undefined;
  authToken: string | undefined;
  orgSlug: string | undefined;
  projectSlug: string | undefined;
  baseUrl: string | undefined;
};

type PostHogProbeConfig = {
  host: string | undefined;
  apiKey: string | undefined;
};

type ModelProviderProbeConfig = {
  apiKey: string | undefined;
  baseUrl: string | undefined;
  model: string | undefined;
};

export interface ReadOnlyIntegrationProbes {
  supabase: IntegrationProbe<SupabaseProbeConfig>;
  github: IntegrationProbe<GitHubProbeConfig>;
  stripe: IntegrationProbe<StripeProbeConfig>;
  webflow: IntegrationProbe<WebflowProbeConfig>;
  wordpress: IntegrationProbe<WordPressProbeConfig>;
  sentry: IntegrationProbe<SentryProbeConfig>;
  posthog: IntegrationProbe<PostHogProbeConfig>;
  openai: IntegrationProbe<ModelProviderProbeConfig>;
  anthropic: IntegrationProbe<ModelProviderProbeConfig>;
  google: IntegrationProbe<ModelProviderProbeConfig>;
  perplexity: IntegrationProbe<ModelProviderProbeConfig>;
  openrouter: IntegrationProbe<ModelProviderProbeConfig>;
}

interface HttpProbeSpec {
  label: string;
  method?: "GET";
  url: string;
  safeTarget: string;
  headers?: Record<string, string>;
  successSummary: string;
  credentialErrors: string[];
}

interface ProbeFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

type ProbeFetch = (input: string, init?: RequestInit) => Promise<ProbeFetchResponse>;

const DEFAULT_TIMEOUT_MS = 8_000;

export function createReadOnlyIntegrationProbes(
  options: ReadOnlyIntegrationProbeOptions = {},
): ReadOnlyIntegrationProbes {
  const fetchImpl = (options.fetchImpl ?? fetch) as ProbeFetch;

  return {
    supabase: (context) => probeSupabase(context, fetchImpl),
    github: (context) => probeGitHub(context, fetchImpl),
    stripe: (context) => probeStripe(context, fetchImpl),
    webflow: (context) => probeWebflow(context, fetchImpl),
    wordpress: (context) => probeWordPress(context, fetchImpl),
    sentry: (context) => probeSentry(context, fetchImpl),
    posthog: (context) => probePostHog(context, fetchImpl),
    openai: (context) => probeOpenAI(context, fetchImpl),
    anthropic: (context) => probeAnthropic(context, fetchImpl),
    google: (context) => probeGoogle(context, fetchImpl),
    perplexity: (context) => probePerplexity(context, fetchImpl),
    openrouter: (context) => probeOpenRouter(context, fetchImpl),
  };
}

function makePolicyEvidence(label: string, detail: string): ProbeEvidence {
  return {
    kind: "policy",
    label,
    result: "blocked",
    detail,
  };
}

function normalizeBaseUrl(baseUrl: string | undefined, fallback: string): string {
  return (baseUrl ?? fallback).replace(/\/+$/, "");
}

function truncate(value: string, limit = 180): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}

function sanitize(value: string, secrets: string[]): string {
  let sanitized = value;
  for (const secret of secrets) {
    if (!secret) {
      continue;
    }

    sanitized = sanitized.split(secret).join("[masked]");
  }

  return sanitized;
}

function classifyHttpFailure(status: number): ProbeEvidence["result"] {
  if (status === 401 || status === 403) {
    return "blocked";
  }

  if (status === 404) {
    return "fail";
  }

  return "error";
}

async function runHttpProbe(fetchImpl: ProbeFetch, spec: HttpProbeSpec): Promise<ProbeOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const requestInit: RequestInit = {
      method: spec.method ?? "GET",
      signal: controller.signal,
    };
    if (spec.headers) {
      requestInit.headers = spec.headers;
    }

    const response = await fetchImpl(spec.url, requestInit);
    const body = sanitize(await response.text(), spec.credentialErrors);
    const evidence: ProbeEvidence = {
      kind: "http",
      label: spec.label,
      result: response.ok ? "pass" : classifyHttpFailure(response.status),
      target: spec.safeTarget,
      detail: `${spec.method ?? "GET"} ${spec.safeTarget} -> HTTP ${response.status}`,
      statusCode: response.status,
      ...(body ? { excerpt: truncate(body) } : {}),
    };

    if (response.ok) {
      return {
        status: "ready",
        summary: spec.successSummary,
        evidence: [evidence],
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: "blocked",
        summary: `${spec.label} rejected the supplied credentials during a read-only probe.`,
        blockers: [`${spec.label} rejected the supplied credentials during a read-only probe.`],
        evidence: [evidence],
      };
    }

    if (response.status === 404) {
      return {
        status: "invalid",
        summary: `${spec.label} probe target was not found.`,
        blockers: [`${spec.label} probe target returned HTTP 404. Check the configured base URL or resource identifier.`],
        evidence: [evidence],
      };
    }

    return {
      status: "unverified",
      summary: `${spec.label} returned an unexpected response during a read-only probe.`,
      blockers: [`${spec.label} returned HTTP ${response.status} during a read-only probe.`],
      evidence: [evidence],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const evidence: ProbeEvidence = {
      kind: "http",
      label: spec.label,
      result: "error",
      target: spec.safeTarget,
      detail: `${spec.method ?? "GET"} ${spec.safeTarget} failed before a response was received`,
      excerpt: truncate(sanitize(message, spec.credentialErrors)),
    };

    return {
      status: "unverified",
      summary: `${spec.label} probe could not complete.`,
      blockers: [`${spec.label} probe failed before a response was received: ${message}.`],
      evidence: [evidence],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeSupabase(
  context: ProbeContext<SupabaseProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  const token = context.config.serviceRoleKey ?? context.config.anonKey;

  if (!context.config.url || !token) {
    return {
      status: "blocked",
      summary: "Supabase live probe could not run because the resolved URL or API token was missing.",
      blockers: ["Supabase live probe requires SUPABASE_URL and a resolved API key."],
      evidence: [makePolicyEvidence("Supabase live probe", "Missing URL or resolved API key for the built-in read-only probe.")],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.url, context.config.url);
  return runHttpProbe(fetchImpl, {
    label: "Supabase live probe",
    url: `${baseUrl}/rest/v1/`,
    safeTarget: `${baseUrl}/rest/v1/`,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
    },
    successSummary: "Supabase accepted a read-only REST probe with the configured credentials.",
    credentialErrors: [token],
  });
}

async function probeGitHub(
  context: ProbeContext<GitHubProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.token) {
    return {
      status: "blocked",
      summary: "GitHub App credentials are structurally valid, but the built-in live probe currently requires GITHUB_TOKEN.",
      blockers: ["Built-in GitHub live probing currently supports GITHUB_TOKEN only. Pass a caller-supplied probe for GitHub App auth."],
      evidence: [
        makePolicyEvidence(
          "GitHub live probe",
          "Skipped built-in GitHub App probing because only token-based read-only verification is implemented.",
        ),
      ],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.baseUrl, "https://api.github.com");
  return runHttpProbe(fetchImpl, {
    label: "GitHub live probe",
    url: `${baseUrl}/user`,
    safeTarget: `${baseUrl}/user`,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${context.config.token}`,
      "User-Agent": "citekit-readiness-probe",
    },
    successSummary: "GitHub accepted a read-only identity probe with the configured token.",
    credentialErrors: [context.config.token],
  });
}

async function probeStripe(
  context: ProbeContext<StripeProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.secretKey) {
    return {
      status: "blocked",
      summary: "Stripe live probe could not run because STRIPE_SECRET_KEY was missing.",
      blockers: ["Stripe live probe requires STRIPE_SECRET_KEY."],
      evidence: [makePolicyEvidence("Stripe live probe", "Missing STRIPE_SECRET_KEY for the built-in read-only probe.")],
    };
  }

  return runHttpProbe(fetchImpl, {
    label: "Stripe live probe",
    url: "https://api.stripe.com/v1/account",
    safeTarget: "https://api.stripe.com/v1/account",
    headers: {
      Authorization: `Bearer ${context.config.secretKey}`,
    },
    successSummary: "Stripe accepted a read-only account probe with the configured key.",
    credentialErrors: [context.config.secretKey],
  });
}

async function probeWebflow(
  context: ProbeContext<WebflowProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.apiToken || !context.config.siteId) {
    return {
      status: "blocked",
      summary: "Webflow live probe could not run because the API token or site identifier was missing.",
      blockers: ["Webflow live probe requires WEBFLOW_API_TOKEN and WEBFLOW_SITE_ID."],
      evidence: [makePolicyEvidence("Webflow live probe", "Missing token or site identifier for the built-in read-only probe.")],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.baseUrl, "https://api.webflow.com");
  return runHttpProbe(fetchImpl, {
    label: "Webflow live probe",
    url: `${baseUrl}/v2/sites/${context.config.siteId}`,
    safeTarget: `${baseUrl}/v2/sites/${context.config.siteId}`,
    headers: {
      Authorization: `Bearer ${context.config.apiToken}`,
      Accept: "application/json",
    },
    successSummary: "Webflow accepted a read-only site lookup with the configured token.",
    credentialErrors: [context.config.apiToken],
  });
}

async function probeWordPress(
  context: ProbeContext<WordPressProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.baseUrl || !context.config.username || !context.config.applicationPassword) {
    return {
      status: "blocked",
      summary: "WordPress live probe could not run because the base URL or credentials were missing.",
      blockers: ["WordPress live probe requires WORDPRESS_BASE_URL, WORDPRESS_USERNAME, and WORDPRESS_APPLICATION_PASSWORD."],
      evidence: [makePolicyEvidence("WordPress live probe", "Missing WordPress base URL or credentials for the built-in probe.")],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.baseUrl, context.config.baseUrl);
  const normalizedPassword = context.config.applicationPassword.replace(/\s+/g, "");
  const basicToken = Buffer.from(`${context.config.username}:${normalizedPassword}`).toString("base64");

  return runHttpProbe(fetchImpl, {
    label: "WordPress live probe",
    url: `${baseUrl}/wp-json/wp/v2/users/me?context=edit`,
    safeTarget: `${baseUrl}/wp-json/wp/v2/users/me?context=edit`,
    headers: {
      Authorization: `Basic ${basicToken}`,
      Accept: "application/json",
    },
    successSummary: "WordPress accepted a read-only authenticated REST probe.",
    credentialErrors: [context.config.username, normalizedPassword, basicToken],
  });
}

async function probeSentry(
  context: ProbeContext<SentryProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.authToken || !context.config.orgSlug || !context.config.projectSlug) {
    return {
      status: "blocked",
      summary: "Sentry DSN is present, but the built-in live probe requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT.",
      blockers: ["Built-in Sentry live probing requires SENTRY_AUTH_TOKEN plus SENTRY_ORG and SENTRY_PROJECT."],
      evidence: [
        makePolicyEvidence(
          "Sentry live probe",
          "Skipped because DSN-only configurations do not expose a safe authenticated read-only verification route.",
        ),
      ],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.baseUrl, "https://sentry.io/api/0");
  return runHttpProbe(fetchImpl, {
    label: "Sentry live probe",
    url: `${baseUrl}/projects/${context.config.orgSlug}/${context.config.projectSlug}/`,
    safeTarget: `${baseUrl}/projects/${context.config.orgSlug}/${context.config.projectSlug}/`,
    headers: {
      Authorization: `Bearer ${context.config.authToken}`,
      Accept: "application/json",
    },
    successSummary: "Sentry accepted a read-only project lookup with the configured token.",
    credentialErrors: [context.config.authToken],
  });
}

async function probePostHog(
  context: ProbeContext<PostHogProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.host || !context.config.apiKey) {
    return {
      status: "blocked",
      summary: "PostHog live probe could not run because POSTHOG_HOST or POSTHOG_API_KEY was missing.",
      blockers: ["PostHog live probe requires POSTHOG_HOST and POSTHOG_API_KEY."],
      evidence: [makePolicyEvidence("PostHog live probe", "Missing PostHog host or API key for the built-in probe.")],
    };
  }

  const host = normalizeBaseUrl(context.config.host, context.config.host);
  return runHttpProbe(fetchImpl, {
    label: "PostHog live probe",
    url: `${host}/api/projects/@current`,
    safeTarget: `${host}/api/projects/@current`,
    headers: {
      Authorization: `Bearer ${context.config.apiKey}`,
      Accept: "application/json",
    },
    successSummary: "PostHog accepted a read-only current-project lookup with the configured API key.",
    credentialErrors: [context.config.apiKey],
  });
}

async function probeOpenAI(
  context: ProbeContext<ModelProviderProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  return probeModelProvider(context, fetchImpl, {
    label: "OpenAI live probe",
    fallbackBaseUrl: "https://api.openai.com/v1",
    path: "/models",
    successSummary: "OpenAI accepted a read-only models probe with the configured API key.",
    authHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  });
}

async function probeAnthropic(
  context: ProbeContext<ModelProviderProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  return probeModelProvider(context, fetchImpl, {
    label: "Anthropic live probe",
    fallbackBaseUrl: "https://api.anthropic.com/v1",
    path: "/models",
    successSummary: "Anthropic accepted a read-only models probe with the configured API key.",
    authHeaders: (apiKey) => ({
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
  });
}

async function probeGoogle(
  context: ProbeContext<ModelProviderProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  if (!context.config.apiKey) {
    return {
      status: "blocked",
      summary: "Google live probe could not run because GOOGLE_API_KEY was missing.",
      blockers: ["Google live probe requires GOOGLE_API_KEY."],
      evidence: [makePolicyEvidence("Google live probe", "Missing GOOGLE_API_KEY for the built-in read-only probe.")],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.baseUrl, "https://generativelanguage.googleapis.com/v1beta");
  return runHttpProbe(fetchImpl, {
    label: "Google live probe",
    url: `${baseUrl}/models?key=${encodeURIComponent(context.config.apiKey)}`,
    safeTarget: `${baseUrl}/models`,
    headers: {
      Accept: "application/json",
    },
    successSummary: "Google accepted a read-only model listing probe with the configured API key.",
    credentialErrors: [context.config.apiKey],
  });
}

async function probePerplexity(
  context: ProbeContext<ModelProviderProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  return probeModelProvider(context, fetchImpl, {
    label: "Perplexity live probe",
    fallbackBaseUrl: "https://api.perplexity.ai/v1",
    path: "/models",
    successSummary: "Perplexity accepted a read-only models probe with the configured API key.",
    authHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  });
}

async function probeOpenRouter(
  context: ProbeContext<ModelProviderProbeConfig>,
  fetchImpl: ProbeFetch,
): Promise<ProbeOutcome> {
  return probeModelProvider(context, fetchImpl, {
    label: "OpenRouter live probe",
    fallbackBaseUrl: "https://openrouter.ai/api/v1",
    path: "/key",
    successSummary: "OpenRouter accepted a read-only current-key probe with the configured API key.",
    authHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  });
}

async function probeModelProvider(
  context: ProbeContext<ModelProviderProbeConfig>,
  fetchImpl: ProbeFetch,
  options: {
    label: string;
    fallbackBaseUrl: string;
    path: string;
    successSummary: string;
    authHeaders: (apiKey: string) => Record<string, string>;
  },
): Promise<ProbeOutcome> {
  if (!context.config.apiKey) {
    return {
      status: "blocked",
      summary: `${options.label} could not run because the API key was missing.`,
      blockers: [`${options.label} requires a resolved API key.`],
      evidence: [makePolicyEvidence(options.label, "Missing API key for the built-in read-only probe.")],
    };
  }

  const baseUrl = normalizeBaseUrl(context.config.baseUrl, options.fallbackBaseUrl);
  return runHttpProbe(fetchImpl, {
    label: options.label,
    url: `${baseUrl}${options.path}`,
    safeTarget: `${baseUrl}${options.path}`,
    headers: {
      Accept: "application/json",
      ...options.authHeaders(context.config.apiKey),
    },
    successSummary: options.successSummary,
    credentialErrors: [context.config.apiKey],
  });
}
