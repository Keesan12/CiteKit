import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditRobots } from "./robots";
import { auditLlmsTxt } from "./llms-txt";
import { auditSchema, parseSchemaBlocks } from "./schema";
import { auditContent } from "./content";
import { auditMeta } from "./meta";
import { auditSpaGap } from "./spa-gap";
import { computeScore, gradeFromScore } from "../score/overall";
import { getFixesForSignals } from "../fixes/catalogue";
import { MAX_SCORE_WITHOUT_PROBE, MAX_SCORE_WITH_PROBE } from "../score/dimensions";
import type { SignalResult } from "../types/index";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(responses: Record<string, { ok: boolean; status: number; body: string; redirected?: boolean; url?: string }>) {
  return vi.fn().mockImplementation((url: string) => {
    const entry = responses[url] ?? { ok: false, status: 404, body: "" };
    return Promise.resolve({
      ok: entry.ok,
      status: entry.status,
      redirected: entry.redirected ?? false,
      url: entry.url ?? url,
      text: () => Promise.resolve(entry.body),
    });
  });
}

// ---------------------------------------------------------------------------
// parseSchemaBlocks
// ---------------------------------------------------------------------------

describe("parseSchemaBlocks", () => {
  it("parses a single schema block", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>`;
    const blocks = parseSchemaBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ "@type": "Organization" });
  });

  it("parses an array of schema blocks in one script tag", () => {
    const html = `<script type="application/ld+json">[{"@type":"Organization"},{"@type":"FAQPage"}]</script>`;
    const blocks = parseSchemaBlocks(html);
    expect(blocks).toHaveLength(2);
  });

  it("skips malformed JSON silently", () => {
    const html = `<script type="application/ld+json">{bad json}</script>`;
    expect(parseSchemaBlocks(html)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// auditSchema
// ---------------------------------------------------------------------------

describe("auditSchema", () => {
  const orgHtml = `
    <script type="application/ld+json">
    {"@type":"Organization","name":"Acme","url":"https://acme.com","sameAs":["https://www.wikidata.org/wiki/Q123"]}
    </script>`;

  const faqHtml = `
    <script type="application/ld+json">
    {"@type":"FAQPage","mainEntity":[
      {"@type":"Question","name":"Q1","acceptedAnswer":{"text":"A1"}},
      {"@type":"Question","name":"Q2","acceptedAnswer":{"text":"A2"}},
      {"@type":"Question","name":"Q3","acceptedAnswer":{"text":"A3"}}
    ]}
    </script>`;

  it("passes schema_organization when Organization block present", () => {
    const results = auditSchema(orgHtml);
    const org = results.find((r) => r.signal === "schema_organization");
    expect(org?.pass).toBe(true);
  });

  it("passes schema_entity_link when wikidata sameAs present", () => {
    const results = auditSchema(orgHtml);
    const el = results.find((r) => r.signal === "schema_entity_link");
    expect(el?.pass).toBe(true);
  });

  it("passes schema_faq with ≥3 entries", () => {
    const results = auditSchema(faqHtml);
    const faq = results.find((r) => r.signal === "schema_faq");
    expect(faq?.pass).toBe(true);
  });

  it("fails schema_faq with <3 entries", () => {
    const html = `<script type="application/ld+json">
    {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Q1"}]}
    </script>`;
    const results = auditSchema(html);
    const faq = results.find((r) => r.signal === "schema_faq");
    expect(faq?.pass).toBe(false);
  });

  it("fails all schema signals on empty HTML", () => {
    const results = auditSchema("");
    expect(results.every((r) => !r.pass)).toBe(true);
  });

  it("passes schema_freshness when Article has datePublished", () => {
    const html = `<script type="application/ld+json">
    {"@type":"Article","headline":"Test","datePublished":"2024-01-01"}
    </script>`;
    const results = auditSchema(html);
    const freshness = results.find((r) => r.signal === "schema_freshness");
    expect(freshness?.pass).toBe(true);
  });

  it("passes schema_rating when AggregateRating present", () => {
    const html = `<script type="application/ld+json">
    {"@type":"Product","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.5"}}
    </script>`;
    const results = auditSchema(html);
    const rating = results.find((r) => r.signal === "schema_rating");
    expect(rating?.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// auditContent
// ---------------------------------------------------------------------------

describe("auditContent", () => {
  it("passes content_word_count with ≥300 words", () => {
    const words = Array.from({ length: 350 }, (_, i) => `word${i}`).join(" ");
    const html = `<body><p>${words}</p></body>`;
    const results = auditContent(html);
    const wc = results.find((r) => r.signal === "content_word_count");
    expect(wc?.pass).toBe(true);
  });

  it("fails content_word_count with sparse content", () => {
    const html = `<body><p>Too short</p></body>`;
    const results = auditContent(html);
    const wc = results.find((r) => r.signal === "content_word_count");
    expect(wc?.pass).toBe(false);
  });

  it("passes content_headings when H2 present", () => {
    const html = `<body><h2>Section</h2><p>text</p></body>`;
    const results = auditContent(html);
    const h = results.find((r) => r.signal === "content_headings");
    expect(h?.pass).toBe(true);
  });

  it("passes content_faq when FAQ-like content present", () => {
    const html = `<body><p>What is our product? It does X. How does it work? FAQ section.</p></body>`;
    const results = auditContent(html);
    const faq = results.find((r) => r.signal === "content_faq");
    expect(faq?.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// auditMeta
// ---------------------------------------------------------------------------

describe("auditMeta", () => {
  it("passes meta_description with correct length", () => {
    const html = `<head><meta name="description" content="This is a good meta description that has enough words to pass the threshold easily."></head>`;
    const results = auditMeta(html);
    const md = results.find((r) => r.signal === "meta_description");
    expect(md?.pass).toBe(true);
  });

  it("fails meta_description when too short", () => {
    const html = `<head><meta name="description" content="Short"></head>`;
    const results = auditMeta(html);
    const md = results.find((r) => r.signal === "meta_description");
    expect(md?.pass).toBe(false);
  });

  it("passes meta_og when both og tags present", () => {
    const html = `<head>
      <meta property="og:title" content="Acme">
      <meta property="og:description" content="Best tool">
    </head>`;
    const results = auditMeta(html);
    const og = results.find((r) => r.signal === "meta_og");
    expect(og?.pass).toBe(true);
  });

  it("passes meta_h1 with short H1", () => {
    const html = `<body><h1>Acme — The Best Tool</h1></body>`;
    const results = auditMeta(html);
    const h1 = results.find((r) => r.signal === "meta_h1");
    expect(h1?.pass).toBe(true);
  });

  it("fails meta_h1 with long H1", () => {
    const html = `<body><h1>This is a very long heading that has too many words to pass the twelve word limit</h1></body>`;
    const results = auditMeta(html);
    const h1 = results.find((r) => r.signal === "meta_h1");
    expect(h1?.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auditSpaGap
// ---------------------------------------------------------------------------

describe("auditSpaGap", () => {
  it("passes when server-rendered content is sufficient", () => {
    const longText = "Lorem ipsum dolor sit amet. ".repeat(30);
    const html = `<body><main>${longText}</main></body>`;
    const result = auditSpaGap(html);
    expect(result.pass).toBe(true);
  });

  it("fails when SPA root with minimal content", () => {
    const html = `<body><div id="root"></div></body>`;
    const result = auditSpaGap(html);
    expect(result.pass).toBe(false);
  });

  it("fails when body text is very sparse", () => {
    const html = `<body><p>Hi</p></body>`;
    const result = auditSpaGap(html);
    expect(result.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auditRobots (with fetch mock)
// ---------------------------------------------------------------------------

describe("auditRobots", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", undefined);
  });

  it("fails when robots.txt not found", async () => {
    vi.stubGlobal("fetch", mockFetch({ "https://example.com/robots.txt": { ok: false, status: 404, body: "" } }));
    const result = await auditRobots("example.com");
    expect(result.pass).toBe(false);
    expect(result.signal).toBe("robots_ai_access");
  });

  it("fails when GPTBot is disallowed", async () => {
    const body = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
    vi.stubGlobal("fetch", mockFetch({ "https://example.com/robots.txt": { ok: true, status: 200, body } }));
    const result = await auditRobots("example.com");
    expect(result.pass).toBe(false);
    expect(result.detail).toContain("GPTBot");
  });

  it("passes when AI bots are explicitly allowed", async () => {
    const body = "User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: *\nAllow: /\n";
    vi.stubGlobal("fetch", mockFetch({ "https://example.com/robots.txt": { ok: true, status: 200, body } }));
    const result = await auditRobots("example.com");
    expect(result.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// auditLlmsTxt (with fetch mock)
// ---------------------------------------------------------------------------

describe("auditLlmsTxt", () => {
  it("fails when llms.txt not found", async () => {
    vi.stubGlobal("fetch", mockFetch({ "https://example.com/llms.txt": { ok: false, status: 404, body: "" } }));
    const result = await auditLlmsTxt("example.com");
    expect(result.pass).toBe(false);
  });

  it("fails when llms.txt has no heading", async () => {
    const body = "just some text without a heading";
    vi.stubGlobal("fetch", mockFetch({ "https://example.com/llms.txt": { ok: true, status: 200, body } }));
    const result = await auditLlmsTxt("example.com");
    expect(result.pass).toBe(false);
  });

  it("passes when llms.txt has heading and content", async () => {
    const body = "# Acme Corp\n\n> The best tool for X.\n\n## Key Pages\n- [Home](https://acme.com)\n";
    vi.stubGlobal("fetch", mockFetch({ "https://example.com/llms.txt": { ok: true, status: 200, body } }));
    const result = await auditLlmsTxt("example.com");
    expect(result.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeScore + gradeFromScore
// ---------------------------------------------------------------------------

describe("computeScore", () => {
  it("returns 0 when no signals pass", () => {
    const signals: SignalResult[] = [
      { signal: "llms_txt", pass: false, weight: 14 },
      { signal: "robots_ai_access", pass: false, weight: 10 },
    ];
    expect(computeScore(signals)).toBe(0);
  });

  it("returns 100 when all signals pass including citation probe", () => {
    const allPass: SignalResult[] = [
      { signal: "robots_ai_access", pass: true, weight: 10 },
      { signal: "llms_txt", pass: true, weight: 14 },
      { signal: "schema_organization", pass: true, weight: 8 },
      { signal: "schema_faq", pass: true, weight: 9 },
      { signal: "schema_author", pass: true, weight: 4 },
      { signal: "schema_freshness", pass: true, weight: 3 },
      { signal: "schema_rating", pass: true, weight: 2 },
      { signal: "schema_entity_link", pass: true, weight: 3 },
      { signal: "content_word_count", pass: true, weight: 3 },
      { signal: "content_headings", pass: true, weight: 2 },
      { signal: "content_faq", pass: true, weight: 4 },
      { signal: "infra_https", pass: true, weight: 2 },
      { signal: "infra_sitemap", pass: true, weight: 3 },
      { signal: "infra_canonical", pass: true, weight: 2 },
      { signal: "meta_description", pass: true, weight: 2 },
      { signal: "meta_og", pass: true, weight: 2 },
      { signal: "meta_h1", pass: true, weight: 2 },
      { signal: "spa_gap", pass: true, weight: 5 },
      { signal: "citation_probe", pass: true, weight: 20 },
    ];
    expect(computeScore(allPass)).toBe(100);
  });

  it("max score without citation probe is 100 when all non-probe pass", () => {
    const signals: SignalResult[] = [
      { signal: "robots_ai_access", pass: true, weight: 10 },
      { signal: "llms_txt", pass: true, weight: 14 },
      { signal: "schema_organization", pass: true, weight: 8 },
      { signal: "schema_faq", pass: true, weight: 9 },
      { signal: "schema_author", pass: true, weight: 4 },
      { signal: "schema_freshness", pass: true, weight: 3 },
      { signal: "schema_rating", pass: true, weight: 2 },
      { signal: "schema_entity_link", pass: true, weight: 3 },
      { signal: "content_word_count", pass: true, weight: 3 },
      { signal: "content_headings", pass: true, weight: 2 },
      { signal: "content_faq", pass: true, weight: 4 },
      { signal: "infra_https", pass: true, weight: 2 },
      { signal: "infra_sitemap", pass: true, weight: 3 },
      { signal: "infra_canonical", pass: true, weight: 2 },
      { signal: "meta_description", pass: true, weight: 2 },
      { signal: "meta_og", pass: true, weight: 2 },
      { signal: "meta_h1", pass: true, weight: 2 },
      { signal: "spa_gap", pass: true, weight: 5 },
    ];
    expect(computeScore(signals)).toBe(100);
  });

  it("scores a small-biz archetype in 0–20 range", () => {
    // minimal site: only HTTPS, word count, headings, H1
    const signals: SignalResult[] = [
      { signal: "robots_ai_access", pass: false, weight: 10 },
      { signal: "llms_txt", pass: false, weight: 14 },
      { signal: "schema_organization", pass: false, weight: 8 },
      { signal: "schema_faq", pass: false, weight: 9 },
      { signal: "schema_author", pass: false, weight: 4 },
      { signal: "schema_freshness", pass: false, weight: 3 },
      { signal: "schema_rating", pass: false, weight: 2 },
      { signal: "schema_entity_link", pass: false, weight: 3 },
      { signal: "content_word_count", pass: true, weight: 3 },
      { signal: "content_headings", pass: true, weight: 2 },
      { signal: "content_faq", pass: false, weight: 4 },
      { signal: "infra_https", pass: true, weight: 2 },
      { signal: "infra_sitemap", pass: false, weight: 3 },
      { signal: "infra_canonical", pass: false, weight: 2 },
      { signal: "meta_description", pass: false, weight: 2 },
      { signal: "meta_og", pass: false, weight: 2 },
      { signal: "meta_h1", pass: true, weight: 2 },
      { signal: "spa_gap", pass: false, weight: 5 },
    ];
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(20);
  });

  it("scores an enterprise archetype in 20–45 range", () => {
    // Good infra + meta + org schema but no AI signals, SPA gap fail
    const signals: SignalResult[] = [
      { signal: "robots_ai_access", pass: false, weight: 10 },
      { signal: "llms_txt", pass: false, weight: 14 },
      { signal: "schema_organization", pass: true, weight: 8 },
      { signal: "schema_faq", pass: false, weight: 9 },
      { signal: "schema_author", pass: false, weight: 4 },
      { signal: "schema_freshness", pass: false, weight: 3 },
      { signal: "schema_rating", pass: false, weight: 2 },
      { signal: "schema_entity_link", pass: true, weight: 3 },
      { signal: "content_word_count", pass: true, weight: 3 },
      { signal: "content_headings", pass: true, weight: 2 },
      { signal: "content_faq", pass: false, weight: 4 },
      { signal: "infra_https", pass: true, weight: 2 },
      { signal: "infra_sitemap", pass: true, weight: 3 },
      { signal: "infra_canonical", pass: true, weight: 2 },
      { signal: "meta_description", pass: true, weight: 2 },
      { signal: "meta_og", pass: true, weight: 2 },
      { signal: "meta_h1", pass: true, weight: 2 },
      { signal: "spa_gap", pass: false, weight: 5 },
    ];
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThanOrEqual(45);
  });

  it("scores a SaaS startup archetype in 45–70 range", () => {
    // Good content + infra + org schema + FAQ, but missing AI-specific signals
    // (no explicit AI bot entries, no llms.txt, no author/freshness/rating/entity_link)
    const signals: SignalResult[] = [
      { signal: "robots_ai_access", pass: false, weight: 10 },
      { signal: "llms_txt", pass: false, weight: 14 },
      { signal: "schema_organization", pass: true, weight: 8 },
      { signal: "schema_faq", pass: true, weight: 9 },
      { signal: "schema_author", pass: true, weight: 4 },
      { signal: "schema_freshness", pass: true, weight: 3 },
      { signal: "schema_rating", pass: false, weight: 2 },
      { signal: "schema_entity_link", pass: false, weight: 3 },
      { signal: "content_word_count", pass: true, weight: 3 },
      { signal: "content_headings", pass: true, weight: 2 },
      { signal: "content_faq", pass: true, weight: 4 },
      { signal: "infra_https", pass: true, weight: 2 },
      { signal: "infra_sitemap", pass: true, weight: 3 },
      { signal: "infra_canonical", pass: true, weight: 2 },
      { signal: "meta_description", pass: true, weight: 2 },
      { signal: "meta_og", pass: true, weight: 2 },
      { signal: "meta_h1", pass: true, weight: 2 },
      { signal: "spa_gap", pass: true, weight: 5 },
    ];
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(70);
  });

  it("scores a fully-optimized domain in 75–100 range", () => {
    // Everything passes including citation probe
    const signals: SignalResult[] = [
      { signal: "robots_ai_access", pass: true, weight: 10 },
      { signal: "llms_txt", pass: true, weight: 14 },
      { signal: "schema_organization", pass: true, weight: 8 },
      { signal: "schema_faq", pass: true, weight: 9 },
      { signal: "schema_author", pass: true, weight: 4 },
      { signal: "schema_freshness", pass: true, weight: 3 },
      { signal: "schema_rating", pass: true, weight: 2 },
      { signal: "schema_entity_link", pass: true, weight: 3 },
      { signal: "content_word_count", pass: true, weight: 3 },
      { signal: "content_headings", pass: true, weight: 2 },
      { signal: "content_faq", pass: true, weight: 4 },
      { signal: "infra_https", pass: true, weight: 2 },
      { signal: "infra_sitemap", pass: true, weight: 3 },
      { signal: "infra_canonical", pass: true, weight: 2 },
      { signal: "meta_description", pass: true, weight: 2 },
      { signal: "meta_og", pass: true, weight: 2 },
      { signal: "meta_h1", pass: true, weight: 2 },
      { signal: "spa_gap", pass: true, weight: 5 },
      { signal: "citation_probe", pass: true, weight: 20 },
    ];
    const score = computeScore(signals);
    expect(score).toBeGreaterThanOrEqual(75);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("gradeFromScore", () => {
  it("returns F for score < 25", () => expect(gradeFromScore(9)).toBe("F"));
  it("returns D for score 25–44", () => expect(gradeFromScore(31)).toBe("D"));
  it("returns C for score 45–64", () => expect(gradeFromScore(55)).toBe("C"));
  it("returns B for score 65–79", () => expect(gradeFromScore(65)).toBe("B"));
  it("returns A for score ≥ 80", () => expect(gradeFromScore(83)).toBe("A"));
});

// ---------------------------------------------------------------------------
// getFixesForSignals
// ---------------------------------------------------------------------------

describe("getFixesForSignals", () => {
  it("returns only fixes for failing signals", () => {
    const signals: SignalResult[] = [
      { signal: "llms_txt", pass: false, weight: 14 },
      { signal: "robots_ai_access", pass: true, weight: 10 },
    ];
    const fixes = getFixesForSignals(signals);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]?.signal).toBe("llms_txt");
  });

  it("sorts fixes by predicted_lift descending", () => {
    const signals: SignalResult[] = [
      { signal: "infra_https", pass: false, weight: 2 },
      { signal: "llms_txt", pass: false, weight: 14 },
      { signal: "schema_organization", pass: false, weight: 8 },
    ];
    const fixes = getFixesForSignals(signals);
    expect(fixes[0]?.signal).toBe("llms_txt");
  });

  it("includes citekit_command when available", () => {
    const signals: SignalResult[] = [{ signal: "llms_txt", pass: false, weight: 14 }];
    const fixes = getFixesForSignals(signals);
    expect(fixes[0]?.citekit_command).toContain("generate-llms-txt");
  });
});

// ---------------------------------------------------------------------------
// Constant checks
// ---------------------------------------------------------------------------

describe("dimensions constants", () => {
  it("MAX_SCORE_WITHOUT_PROBE is 80", () => {
    expect(MAX_SCORE_WITHOUT_PROBE).toBe(80);
  });

  it("MAX_SCORE_WITH_PROBE is 100", () => {
    expect(MAX_SCORE_WITH_PROBE).toBe(100);
  });
});
