import chalk from "chalk";
import { Command } from "commander";
import got from "got";
import * as cheerio from "cheerio";
import ora from "ora";
import { addExamples, addJsonOption, normalizeCliDomain, printJson } from "./shared";

interface VoiceCheck {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  fix?: string;
  predicted_lift: number;
}

function vc(
  label: string,
  status: VoiceCheck["status"],
  detail: string,
  predicted_lift: number,
  fix?: string,
): VoiceCheck {
  const c: VoiceCheck = { label, status, detail, predicted_lift };
  if (fix !== undefined) c.fix = fix;
  return c;
}

interface VoiceReport {
  domain: string;
  overall: "optimized" | "partial" | "missing";
  score: number;
  checks: VoiceCheck[];
}

function parseSchemas(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const schemas: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed: unknown = JSON.parse($(el).text());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") schemas.push(item as Record<string, unknown>);
      }
    } catch { /* skip */ }
  });
  return schemas;
}

function getType(s: Record<string, unknown>): string[] {
  const t = s["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t.map(String) : [String(t)];
}

function analyzeVoice(domain: string, html: string): VoiceReport {
  const $ = cheerio.load(html);
  const schemas = parseSchemas(html);
  const checks: VoiceCheck[] = [];

  // Check 1: Speakable schema — tells Google/Alexa which sections to read aloud
  const hasSpeakable = schemas.some(
    (s) => Boolean(s["speakable"]) || Boolean(s["speakableSpecification"]),
  );
  checks.push(vc(
    "Speakable schema",
    hasSpeakable ? "pass" : "fail",
    hasSpeakable ? "speakable or speakableSpecification detected" : "No speakable markup found — voice assistants cannot identify what to read",
    18,
    hasSpeakable ? undefined : 'Add speakableSpecification to your WebPage schema: { "@type": "SpeakableSpecification", "cssSelector": ["h1", ".summary"] }',
  ));

  // Check 2: FAQPage schema — ChatGPT and Perplexity extract FAQ answers directly
  const faqSchemas = schemas.filter((s) => getType(s).includes("FAQPage"));
  const faqEntries = faqSchemas.flatMap((s) => {
    const e = s["mainEntity"];
    return Array.isArray(e) ? e : [];
  });
  const faqStatus = faqSchemas.length > 0 ? (faqEntries.length >= 3 ? "pass" : "warn") : "fail";
  const faqDetail = faqSchemas.length > 0
    ? `${faqEntries.length} FAQ entr${faqEntries.length === 1 ? "y" : "ies"} found`
    : "No FAQPage schema — AI assistants use FAQ markup for direct answers";
  const faqFix = faqSchemas.length === 0
    ? "Add FAQPage JSON-LD with at least 5 question/answer pairs covering your core use cases"
    : faqEntries.length < 3
      ? "Add more FAQ entries (aim for 5+) to improve AI answer coverage"
      : undefined;
  checks.push(vc("FAQPage schema", faqStatus, faqDetail, 22, faqFix));

  // Check 3: HowTo schema — extracted by AI for process/tutorial queries
  const hasHowTo = schemas.some((s) => getType(s).includes("HowTo"));
  checks.push(vc(
    "HowTo schema",
    hasHowTo ? "pass" : "warn",
    hasHowTo ? "HowTo schema detected" : "No HowTo schema — add for any setup, tutorial, or process pages",
    12,
    hasHowTo ? undefined : "Add HowTo JSON-LD on tutorial/guide pages — AI assistants cite step-by-step content heavily",
  ));

  // Check 4: Voice-optimized title (under 9 words, ideally a question or clear noun phrase)
  const title = $("title").text().trim();
  const titleWords = title.split(/\s+/).filter(Boolean).length;
  const titleOk = titleWords > 0 && titleWords <= 9;
  checks.push(vc(
    "Voice-friendly page title",
    titleOk ? "pass" : "warn",
    title ? `"${title.slice(0, 60)}" (${titleWords} words)` : "No <title> found",
    8,
    titleOk ? undefined : "Shorten <title> to under 9 words — voice assistants read page titles when citing sources",
  ));

  // Check 5: H1 clarity — voice engines read the first H1 as the page topic
  const h1 = $("h1").first().text().trim();
  const h1Words = h1.split(/\s+/).filter(Boolean).length;
  const h1Status: VoiceCheck["status"] = h1 && h1Words <= 12 ? "pass" : h1 ? "warn" : "fail";
  const h1Fix = !h1
    ? "Add an <h1> that clearly states what the page/product is in under 12 words"
    : h1Words > 12
      ? "Shorten your <h1> to under 12 words for better voice assistant extraction"
      : undefined;
  checks.push(vc(
    "Clear H1 heading",
    h1Status,
    h1 ? `"${h1.slice(0, 60)}" (${h1Words} words)` : "No <h1> found on homepage",
    6,
    h1Fix,
  ));

  // Check 6: Organization name + description length for voice reading
  const orgSchemas = schemas.filter((s) =>
    getType(s).some((t) => t === "Organization" || t === "LocalBusiness"),
  );
  const orgDescription = orgSchemas[0]?.["description"];
  const descWords =
    typeof orgDescription === "string" ? orgDescription.split(/\s+/).filter(Boolean).length : 0;
  const descOk = descWords >= 10 && descWords <= 30;
  const descStatus: VoiceCheck["status"] = orgSchemas.length === 0 ? "fail" : descOk ? "pass" : "warn";
  const descDetail = orgSchemas.length === 0
    ? "No Organization schema found"
    : descWords === 0
      ? "Organization schema has no description"
      : `description is ${descWords} words (target: 10–30)`;
  const descFix = orgSchemas.length === 0
    ? "Add Organization schema with a 10–30 word description — voice assistants read this when naming your brand"
    : !descOk
      ? "Update Organization description to 10–30 words for optimal voice reading"
      : undefined;
  checks.push(vc("Organization description length", descStatus, descDetail, 10, descFix));

  const passCount = checks.filter((c) => c.status === "pass").length;
  const score = Math.round((passCount / checks.length) * 100);
  const overall: VoiceReport["overall"] =
    score >= 80 ? "optimized" : score >= 40 ? "partial" : "missing";

  return { domain, overall, score, checks };
}

function renderVoiceReport(report: VoiceReport): string {
  const statusColor = report.overall === "optimized"
    ? chalk.green
    : report.overall === "partial"
      ? chalk.yellow
      : chalk.red;

  const lines = [
    chalk.bold("CiteKit Voice & AI Assistant Audit"),
    `Domain: ${report.domain}`,
    "",
    `Voice Readiness: ${statusColor(report.overall.toUpperCase())}  ${statusColor(report.score.toString())}/100`,
    "",
    chalk.bold("Checks"),
  ];

  for (const check of report.checks) {
    const icon =
      check.status === "pass"
        ? chalk.green("✓")
        : check.status === "warn"
          ? chalk.yellow("~")
          : chalk.red("✗");
    const statusLabel =
      check.status === "pass"
        ? chalk.green("PASS")
        : check.status === "warn"
          ? chalk.yellow("WARN")
          : chalk.red("FAIL");
    const lift = check.status !== "pass" ? chalk.dim(` [+${check.predicted_lift} lift]`) : "";
    lines.push(`${icon} ${check.label.padEnd(36, " ")} ${statusLabel}${lift}`);
    lines.push(`  ${chalk.dim(check.detail)}`);
    if (check.fix) {
      lines.push(`  ${chalk.dim("fix: " + check.fix)}`);
    }
  }

  const totalLift = report.checks
    .filter((c) => c.status !== "pass")
    .reduce((sum, c) => sum + c.predicted_lift, 0);

  if (totalLift > 0) {
    lines.push(
      "",
      chalk.yellow("━".repeat(44)),
      `  ${chalk.bold(`Estimated voice citation lift if all gaps fixed: +${totalLift} points`)}`,
      "  Run citekit scan to get ranked fix candidates:",
      `  ${chalk.cyan("→ citeops.ai/upgrade")} for automated voice schema fixes`,
      chalk.yellow("━".repeat(44)),
    );
  }

  return `${lines.join("\n")}\n`;
}

export const voiceCommand = addExamples(
  addJsonOption(
    new Command("voice")
      .summary("Audit voice search and AI assistant optimization")
      .description(
        "Check speakable schema, FAQPage, HowTo, and voice-friendly content signals.\n" +
        "Voice assistants (Google, Alexa, Siri) and AI engines (ChatGPT, Perplexity) extract\n" +
        "structured answers from these signals — most sites have none of them.",
      )
      .requiredOption("--domain <domain>", "Domain to audit"),
  ).action(async (options: { domain: string; json?: boolean }) => {
    const domain = normalizeCliDomain(options.domain);
    const spinner = ora(`Auditing voice signals for ${domain}…`).start();

    let html: string;
    try {
      const res = await got(`https://${domain}`, {
        timeout: { request: 15_000 },
        throwHttpErrors: false,
        headers: { "user-agent": "CiteOps voice-audit (+https://citeops.ai)" },
      });
      if (res.statusCode >= 400) {
        throw new Error(`HTTP ${res.statusCode}`);
      }
      html = res.body;
      spinner.succeed(`Fetched ${domain}`);
    } catch (err) {
      spinner.fail(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }

    const report = analyzeVoice(domain, html);

    if (options.json) {
      printJson(report);
      return;
    }

    process.stdout.write(renderVoiceReport(report));
  }),
  [
    "citekit voice --domain acme.com",
    "citekit voice --domain acme.com --json",
  ],
);
