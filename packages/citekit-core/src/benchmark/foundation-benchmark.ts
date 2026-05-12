import * as cheerio from "cheerio";
import got from "got";
import { normalizeDomain } from "../utils/slug";
import { normalizeWhitespace } from "../utils/text";

const BOT_USER_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
] as const;

const RSS_CANDIDATE_PATHS = ["/feed", "/rss.xml", "/feed.xml", "/blog/rss.xml"] as const;

export interface BenchmarkTarget {
  name: string;
  domain: string;
  segment?: string;
  founderOwned?: boolean;
}

export interface PageSignal {
  url: string;
  title: string;
  metaDescription: boolean;
  canonical: boolean;
  schemaBlocks: number;
  semanticTags: number;
  textLength: number;
  hasAuthorSignal: boolean;
  hasStatsSignal: boolean;
  hasFreshnessSignal: boolean;
  hasPricingSignal: boolean;
  hasDocsSignal: boolean;
  hasComparisonSignal: boolean;
}

export interface FoundationBenchmarkScores {
  agent_readiness: number;
  decision_surface: number;
  trust_density: number;
  overall: number;
}

export interface FoundationBenchmarkMetrics {
  llms_txt: boolean;
  llms_full_txt: boolean;
  robots_txt: boolean;
  ai_bot_allowance_pct: number;
  sitemap: boolean;
  rss: boolean;
  schema_coverage_pct: number;
  canonical_coverage_pct: number;
  semantic_coverage_pct: number;
  freshness_coverage_pct: number;
  author_coverage_pct: number;
  stats_coverage_pct: number;
  pricing_page: boolean;
  docs_page: boolean;
  comparison_page: boolean;
  sampled_pages: number;
}

export interface FoundationBenchmarkResult {
  name: string;
  domain: string;
  segment: string;
  founderOwned: boolean;
  auditedAt: string;
  scores: FoundationBenchmarkScores;
  metrics: FoundationBenchmarkMetrics;
  topActions: string[];
  sampleUrls: string[];
  status: "ok" | "error";
  error?: string;
}

interface RobotsSection {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  sitemaps: string[];
}

interface FetchResult {
  url: string;
  html: string;
  statusCode: number;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toAbsoluteUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, userAgent = "CiteOps benchmark (+https://citeops.ai)"): Promise<FetchResult | null> {
  try {
    const response = await got(url, {
      timeout: { request: 12_000 },
      throwHttpErrors: false,
      followRedirect: true,
      https: { rejectUnauthorized: true },
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (response.statusCode >= 400 || !response.body) {
      return null;
    }

    return {
      url: response.url,
      html: response.body,
      statusCode: response.statusCode,
    };
  } catch {
    return null;
  }
}

function extractPageSignal(url: string, html: string): { signal: PageSignal; internalLinks: string[] } {
  const $ = cheerio.load(html);
  const text = normalizeWhitespace($("main").text() || $("body").text());
  const internalLinks = $("a[href]")
    .map((_, element) => $(element).attr("href"))
    .get()
    .filter((value): value is string => Boolean(value));
  const semanticTags = ["main", "nav", "article", "section", "aside", "header", "footer"].reduce(
    (total, tag) => total + $(tag).length,
    0,
  );
  const lower = text.toLowerCase();

  return {
    signal: {
      url,
      title: $("title").text().trim(),
      metaDescription: Boolean($('meta[name="description"]').attr("content")?.trim()),
      canonical: Boolean($('link[rel="canonical"]').attr("href")?.trim()),
      schemaBlocks: $('script[type="application/ld+json"]').length,
      semanticTags,
      textLength: text.length,
      hasAuthorSignal: /written by|author|editor|contributor|byline/.test(lower),
      hasStatsSignal: /\b\d+(\.\d+)?(%|x|ms|mrr|customers?|teams?|hours?|days?|minutes?)\b/i.test(text),
      hasFreshnessSignal: /last updated|updated|published|2025|2026/i.test(text),
      hasPricingSignal: /pricing|plan|plans/.test(url.toLowerCase()) || /pricing|plans/.test(lower),
      hasDocsSignal: /docs|documentation|guide|reference|api/.test(url.toLowerCase()) || /documentation|api reference|developer/.test(lower),
      hasComparisonSignal: /compare|versus|\/vs\//.test(url.toLowerCase()) || /\bvs\b|alternative|compared to/.test(lower),
    },
    internalLinks,
  };
}

function parseRobotsTxt(input: string): RobotsSection[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
  const sections: RobotsSection[] = [];
  let current: RobotsSection | null = null;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (!key || !value) {
      continue;
    }

    if (key === "user-agent") {
      if (!current || current.allow.length > 0 || current.disallow.length > 0 || current.sitemaps.length > 0) {
        current = { userAgents: [], allow: [], disallow: [], sitemaps: [] };
        sections.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === "allow") {
      current.allow.push(value);
    } else if (key === "disallow") {
      current.disallow.push(value);
    } else if (key === "sitemap") {
      current.sitemaps.push(value);
    }
  }

  return sections;
}

function selectRobotsSection(sections: RobotsSection[], userAgent: string): RobotsSection | null {
  const lower = userAgent.toLowerCase();
  return (
    sections.find((section) => section.userAgents.includes(lower)) ??
    sections.find((section) => section.userAgents.includes("*")) ??
    null
  );
}

function pathAllowed(section: RobotsSection | null, path: string): boolean {
  if (!section) {
    return true;
  }

  let bestRule: { type: "allow" | "disallow"; length: number } | null = null;
  for (const allow of section.allow) {
    if (allow && path.startsWith(allow) && (!bestRule || allow.length > bestRule.length)) {
      bestRule = { type: "allow", length: allow.length };
    }
  }
  for (const disallow of section.disallow) {
    if (disallow && path.startsWith(disallow) && (!bestRule || disallow.length > bestRule.length)) {
      bestRule = { type: "disallow", length: disallow.length };
    }
  }

  return bestRule?.type !== "disallow";
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await got(url, {
      timeout: { request: 8_000 },
      throwHttpErrors: false,
      followRedirect: true,
      headers: { "user-agent": "CiteOps benchmark (+https://citeops.ai)" },
    });
    if (response.statusCode >= 400 || !response.body.trim()) {
      return null;
    }
    return response.body;
  } catch {
    return null;
  }
}

async function hasFeed(baseUrl: string): Promise<boolean> {
  for (const path of RSS_CANDIDATE_PATHS) {
    const body = await fetchText(`${baseUrl.replace(/\/$/, "")}${path}`);
    if (body) {
      return true;
    }
  }
  return false;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildTopActions(metrics: FoundationBenchmarkMetrics): string[] {
  const actions: Array<{ action: string; priority: number }> = [];
  if (!metrics.llms_txt) {
    actions.push({ action: "Publish a curated /llms.txt with the pages you want models to trust first.", priority: 100 });
  }
  if (!metrics.llms_full_txt) {
    actions.push({ action: "Add /llms-full.txt so assistants can ingest a fuller canon of your product truth.", priority: 95 });
  }
  if (metrics.ai_bot_allowance_pct < 100) {
    actions.push({ action: "Fix robots or WAF rules so major AI crawlers can fetch the site reliably.", priority: 92 });
  }
  if (metrics.schema_coverage_pct < 60) {
    actions.push({ action: "Expand JSON-LD coverage across your money pages, not just the homepage.", priority: 90 });
  }
  if (!metrics.comparison_page) {
    actions.push({ action: "Ship comparison and alternatives pages because buyers ask models to choose for them.", priority: 86 });
  }
  if (!metrics.pricing_page) {
    actions.push({ action: "Publish transparent pricing so assistants can answer budget and fit questions without deferring.", priority: 84 });
  }
  if (!metrics.docs_page) {
    actions.push({ action: "Create answer-first documentation pages that models can retrieve and cite cleanly.", priority: 82 });
  }
  if (metrics.freshness_coverage_pct < 50) {
    actions.push({ action: "Add visible update timestamps and refresh high-value pages with current-year proof.", priority: 80 });
  }
  if (metrics.author_coverage_pct < 30) {
    actions.push({ action: "Add real author/entity signals so models can trust the source behind the content.", priority: 76 });
  }
  if (metrics.stats_coverage_pct < 40) {
    actions.push({ action: "Inject concrete proof points and proprietary numbers instead of purely narrative marketing copy.", priority: 72 });
  }

  return actions
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 4)
    .map((item) => item.action);
}

function scoreBenchmark(metrics: FoundationBenchmarkMetrics): FoundationBenchmarkScores {
  const agentReadiness = clampScore(
    (metrics.llms_txt ? 20 : 0) +
      (metrics.llms_full_txt ? 8 : 0) +
      (metrics.robots_txt ? 8 : 0) +
      metrics.ai_bot_allowance_pct * 0.24 +
      (metrics.sitemap ? 12 : 0) +
      (metrics.rss ? 6 : 0) +
      metrics.schema_coverage_pct * 0.22 +
      metrics.canonical_coverage_pct * 0.12 +
      metrics.semantic_coverage_pct * 0.08,
  );

  const decisionSurface = clampScore(
    (metrics.pricing_page ? 18 : 0) +
      (metrics.docs_page ? 18 : 0) +
      (metrics.comparison_page ? 24 : 0) +
      metrics.freshness_coverage_pct * 0.18 +
      metrics.stats_coverage_pct * 0.12 +
      Math.min(24, metrics.sampled_pages * 4),
  );

  const trustDensity = clampScore(
    metrics.schema_coverage_pct * 0.28 +
      metrics.author_coverage_pct * 0.24 +
      metrics.stats_coverage_pct * 0.2 +
      metrics.freshness_coverage_pct * 0.14 +
      metrics.canonical_coverage_pct * 0.14,
  );

  return {
    agent_readiness: agentReadiness,
    decision_surface: decisionSurface,
    trust_density: trustDensity,
    overall: clampScore(agentReadiness * 0.4 + decisionSurface * 0.35 + trustDensity * 0.25),
  };
}

export async function benchmarkFoundation(target: BenchmarkTarget, maxPages = 6): Promise<FoundationBenchmarkResult> {
  const baseUrl = target.domain.startsWith("http") ? target.domain : `https://${target.domain}`;
  const initial = await fetchHtml(baseUrl);

  if (!initial) {
    return {
      name: target.name,
      domain: target.domain,
      segment: target.segment ?? "market",
      founderOwned: target.founderOwned ?? false,
      auditedAt: new Date().toISOString(),
      scores: { agent_readiness: 0, decision_surface: 0, trust_density: 0, overall: 0 },
      metrics: {
        llms_txt: false,
        llms_full_txt: false,
        robots_txt: false,
        ai_bot_allowance_pct: 0,
        sitemap: false,
        rss: false,
        schema_coverage_pct: 0,
        canonical_coverage_pct: 0,
        semantic_coverage_pct: 0,
        freshness_coverage_pct: 0,
        author_coverage_pct: 0,
        stats_coverage_pct: 0,
        pricing_page: false,
        docs_page: false,
        comparison_page: false,
        sampled_pages: 0,
      },
      topActions: ["Make the site reachable and crawlable before attempting deeper AEO improvements."],
      sampleUrls: [],
      status: "error",
      error: "Homepage crawl failed or returned no readable HTML.",
    };
  }

  const normalizedHost = normalizeDomain(initial.url);
  const visited = new Set<string>();
  const queue = [initial.url];
  const pages: PageSignal[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const nextUrl = queue.shift();
    if (!nextUrl || visited.has(nextUrl)) {
      continue;
    }
    visited.add(nextUrl);

    const fetched = nextUrl === initial.url ? initial : await fetchHtml(nextUrl);
    if (!fetched) {
      continue;
    }

    const { signal, internalLinks } = extractPageSignal(fetched.url, fetched.html);
    pages.push(signal);

    for (const href of internalLinks.slice(0, 40)) {
      const absolute = toAbsoluteUrl(fetched.url, href);
      if (!absolute) {
        continue;
      }
      if (!normalizeDomain(absolute).includes(normalizedHost)) {
        continue;
      }
      if (!visited.has(absolute)) {
        queue.push(absolute);
      }
    }
  }

  const robotsBody = await fetchText(`${new URL(initial.url).origin}/robots.txt`);
  const robotsSections = robotsBody ? parseRobotsTxt(robotsBody) : [];
  const aiBotAllowancePct = clampScore(
    average(
      BOT_USER_AGENTS.map((bot) => {
        const section = selectRobotsSection(robotsSections, bot);
        const allowedByRobots = pathAllowed(section, "/");
        return allowedByRobots ? 100 : 0;
      }),
    ),
  );
  const sitemapUrls = robotsSections.flatMap((section) => section.sitemaps);
  const sitemap = sitemapUrls.length > 0 || Boolean(await fetchText(`${new URL(initial.url).origin}/sitemap.xml`));
  const rss = await hasFeed(new URL(initial.url).origin);
  const llmsTxt = Boolean(await fetchText(`${new URL(initial.url).origin}/llms.txt`));
  const llmsFullTxt = Boolean(await fetchText(`${new URL(initial.url).origin}/llms-full.txt`));

  const schemaCoveragePct = clampScore(average(pages.map((page) => (page.schemaBlocks > 0 ? 100 : 0))));
  const canonicalCoveragePct = clampScore(average(pages.map((page) => (page.canonical ? 100 : 0))));
  const semanticCoveragePct = clampScore(average(pages.map((page) => (page.semanticTags >= 3 ? 100 : page.semanticTags * 25))));
  const freshnessCoveragePct = clampScore(average(pages.map((page) => (page.hasFreshnessSignal ? 100 : 0))));
  const authorCoveragePct = clampScore(average(pages.map((page) => (page.hasAuthorSignal ? 100 : 0))));
  const statsCoveragePct = clampScore(average(pages.map((page) => (page.hasStatsSignal ? 100 : 0))));

  const metrics: FoundationBenchmarkMetrics = {
    llms_txt: llmsTxt,
    llms_full_txt: llmsFullTxt,
    robots_txt: Boolean(robotsBody),
    ai_bot_allowance_pct: aiBotAllowancePct,
    sitemap,
    rss,
    schema_coverage_pct: schemaCoveragePct,
    canonical_coverage_pct: canonicalCoveragePct,
    semantic_coverage_pct: semanticCoveragePct,
    freshness_coverage_pct: freshnessCoveragePct,
    author_coverage_pct: authorCoveragePct,
    stats_coverage_pct: statsCoveragePct,
    pricing_page: pages.some((page) => page.hasPricingSignal),
    docs_page: pages.some((page) => page.hasDocsSignal),
    comparison_page: pages.some((page) => page.hasComparisonSignal),
    sampled_pages: pages.length,
  };

  return {
    name: target.name,
    domain: target.domain,
    segment: target.segment ?? "market",
    founderOwned: target.founderOwned ?? false,
    auditedAt: new Date().toISOString(),
    scores: scoreBenchmark(metrics),
    metrics,
    topActions: buildTopActions(metrics),
    sampleUrls: pages.map((page) => page.url),
    status: "ok",
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  input: readonly TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const queue = [...input];
  const results: TOutput[] = [];

  async function runWorker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        return;
      }
      results.push(await worker(item));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, input.length) }, () => runWorker()));
  return results;
}

export async function benchmarkFoundationBatch(
  targets: readonly BenchmarkTarget[],
  options: { maxPages?: number; concurrency?: number } = {},
): Promise<FoundationBenchmarkResult[]> {
  const maxPages = options.maxPages ?? 6;
  const concurrency = options.concurrency ?? 4;
  const results = await mapWithConcurrency(targets, concurrency, async (target) => benchmarkFoundation(target, maxPages));
  return results.sort((left, right) => right.scores.overall - left.scores.overall);
}
