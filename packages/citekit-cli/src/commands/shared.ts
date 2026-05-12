import { config as loadEnv } from "dotenv";
import chalk from "chalk";
import type { Command } from "commander";
import {
  crawlSite,
  createProbeProviders,
  diagnoseBrand,
  generateFixes,
  generatePrompts,
  normalizeDomain,
  runProbeBatch,
  scoreExtraction,
  type BrandSeed,
  type DiagnosisGap,
  type GeneratedFix,
  type ProbeRunResult,
  type PromptDraft,
  type VisibilityScore,
} from "citekit-core";

loadEnv();

const COMMAND_NOTE =
  "Provider-backed commands require at least one configured provider key such as OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, PERPLEXITY_API_KEY, or OPENROUTER_API_KEY.";

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

const STATUS_WEIGHTS: Record<VisibilityScore["recommendation_status"], number> = {
  won: 100,
  visible: 74,
  at_risk: 46,
  lost: 18,
  wrong: 12,
  unanswerable: 0,
};

export interface CliBrandInput {
  name: string;
  domain: string;
  category?: string;
  persona?: string;
  description?: string;
  competitors?: string[];
}

export interface ScanPromptResult {
  prompt: PromptDraft;
  runs: ProbeRunResult[];
  score: VisibilityScore;
  diagnoses: DiagnosisGap[];
}

export interface ScanSummary {
  command: string;
  promptCount: number;
  engineCount: number;
  totalRuns: number;
  overallScore: number;
  recommendationStatus: VisibilityScore["recommendation_status"];
  averageCitationSharePct: number;
  missingPromptCount: number;
  topCompetitor: string | null;
  engineCoverage: Array<{
    engine: string;
    coveragePct: number;
  }>;
  recommendedFixes: string[];
  prompts: ScanPromptResult[];
  fixes: GeneratedFix[];
}

interface BrandOptionValues {
  name: string;
  domain: string;
  category?: string;
  persona?: string;
  description?: string;
  competitor?: string[];
}

export function buildExamplesHelp(examples: string[], note?: string): string {
  const lines = ["", "Examples:", ...examples.map((example) => `  ${example}`)];

  if (note) {
    lines.push("", note);
  }

  return `\n${lines.join("\n")}\n`;
}

export function addBrandOptions(command: Command): Command {
  return command
    .requiredOption("--name <name>", "Brand name")
    .requiredOption("--domain <domain>", "Brand domain or canonical site URL")
    .option("--category <category>", "Brand category")
    .option("--persona <persona>", "Target persona")
    .option("--description <description>", "Short brand description")
    .option("--competitor <name...>", "Competitor names");
}

export function addJsonOption(command: Command, description = "Print JSON output"): Command {
  return command.option("--json", description);
}

export function addExamples(command: Command, examples: string[], note?: string): Command {
  return command.showHelpAfterError().addHelpText("after", buildExamplesHelp(examples, note));
}

function trimToUndefined(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeCliDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("`--domain` must not be empty.");
  }

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const normalized = normalizeDomain(parsed.host);
    if (!normalized) {
      throw new Error();
    }
    return normalized;
  } catch {
    const fallback = normalizeDomain(trimmed.split(/[/?#]/, 1)[0] ?? "");
    if (!fallback) {
      throw new Error(`Could not parse domain from "${input}".`);
    }
    return fallback;
  }
}

export function parsePositiveIntegerOption(
  value: string | undefined,
  optionName: string,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`\`${optionName}\` must be a positive integer. Received "${value}".`);
  }

  return parsed;
}

export function toCliBrandInput(options: BrandOptionValues): CliBrandInput {
  const competitors = Array.from(
    new Set((options.competitor ?? []).map((value) => value.trim()).filter(Boolean)),
  );

  const input: CliBrandInput = {
    name: options.name.trim(),
    domain: normalizeCliDomain(options.domain),
  };

  const category = trimToUndefined(options.category);
  if (category) {
    input.category = category;
  }

  const persona = trimToUndefined(options.persona);
  if (persona) {
    input.persona = persona;
  }

  const description = trimToUndefined(options.description);
  if (description) {
    input.description = description;
  }

  if (competitors.length > 0) {
    input.competitors = competitors;
  }

  return input;
}

export function formatCliError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown CLI failure.";
  return chalk.red(`Error: ${message}`);
}

export function providerCommandNote(): string {
  return COMMAND_NOTE;
}

export function toBrandSeed(input: CliBrandInput): BrandSeed {
  return {
    name: input.name,
    domain: input.domain,
    category: input.category,
    targetPersona: input.persona,
    description: input.description,
    competitors: (input.competitors ?? []).map((name) => ({ name })),
  };
}

function createProbeContext(input: CliBrandInput, prompt: PromptDraft) {
  const seed = toBrandSeed(input);
  return {
    brand: {
      id: crypto.randomUUID(),
      name: seed.name,
      domain: seed.domain,
      category: seed.category ?? null,
      description: seed.description ?? null,
      target_persona: seed.targetPersona ?? null,
    },
    prompt: { id: crypto.randomUUID(), ...prompt },
    competitors: seed.competitors.map((competitor) => ({
      name: competitor.name,
      domain: competitor.domain ?? null,
    })),
  };
}

export async function runSinglePromptProbe(input: CliBrandInput, promptOverride?: string) {
  const seed = toBrandSeed(input);
  const generatedPrompt = requireValue(generatePrompts(seed, 1)[0], "Prompt generation returned no prompts.");
  const prompt = promptOverride
    ? { prompt_text: promptOverride, intent_type: "best_tool" as const, buyer_stage: null, priority: 10 }
    : generatedPrompt;
  const providers = createProbeProviders();

  if (providers.length === 0) {
    throw new Error("No probe providers are configured. Add at least one provider API key to your environment.");
  }

  return runProbeBatch(providers, createProbeContext(input, prompt));
}

export async function runDiagnosis(input: CliBrandInput, promptOverride?: string): Promise<DiagnosisGap[]> {
  const probe = await runSinglePromptProbe(input, promptOverride);
  const firstRun = requireValue(probe.runs[0], "Probe completed without any provider runs.");
  const promptText =
    promptOverride ??
    requireValue(generatePrompts(toBrandSeed(input), 1)[0], "Prompt generation returned no prompts.").prompt_text;
  const site = await crawlSite(input.domain);

  return diagnoseBrand({
    brand: {
      name: input.name,
      domain: input.domain,
      category: input.category ?? null,
      description: input.description ?? null,
      target_persona: input.persona ?? null,
    },
    competitors: (input.competitors ?? []).map((name) => ({ name, domain: null })),
    extraction: firstRun.extraction,
    site,
    prompt: {
      id: crypto.randomUUID(),
      prompt_text: promptText,
      intent_type: "best_tool",
    },
    engine: firstRun.engine,
  });
}

export async function runFixGeneration(input: CliBrandInput, promptOverride?: string) {
  const diagnoses = await runDiagnosis(input, promptOverride);
  return generateFixes(
    diagnoses.map((diagnosis) => ({
      brand: {
        name: input.name,
        domain: input.domain,
        category: input.category ?? null,
        description: input.description ?? null,
        target_persona: input.persona ?? null,
      },
      diagnosis,
      competitors: (input.competitors ?? []).map((name) => ({ name, domain: null })),
    })),
  );
}

export async function runScan(
  input: CliBrandInput,
  options: {
    promptCount?: number;
    promptOverride?: string;
  } = {},
): Promise<ScanSummary> {
  const providers = createProbeProviders();
  if (providers.length === 0) {
    throw new Error("No probe providers are configured. Add at least one provider API key to your environment.");
  }

  const prompts = options.promptOverride
    ? [{ prompt_text: options.promptOverride, intent_type: "best_tool" as const, buyer_stage: null, priority: 10 }]
    : generatePrompts(toBrandSeed(input), options.promptCount ?? 5);

  const site = await crawlSite(input.domain);
  const promptResults: ScanPromptResult[] = [];

  for (const prompt of prompts) {
    const probeBatch = await runProbeBatch(providers, createProbeContext(input, prompt));
    const firstRun = requireValue(probeBatch.runs[0], "Probe completed without any provider runs.");
    const score = renderScore(input, firstRun.extraction);
    const diagnoses = diagnoseBrand({
      brand: {
        name: input.name,
        domain: input.domain,
        category: input.category ?? null,
        description: input.description ?? null,
        target_persona: input.persona ?? null,
      },
      competitors: (input.competitors ?? []).map((name) => ({ name, domain: null })),
      extraction: firstRun.extraction,
      site,
      prompt: {
        id: crypto.randomUUID(),
        prompt_text: prompt.prompt_text,
        intent_type: prompt.intent_type,
      },
      engine: firstRun.engine,
    });

    promptResults.push({
      prompt,
      runs: probeBatch.runs,
      score,
      diagnoses,
    });
  }

  const fixes = generateFixes(
    promptResults.flatMap((result) =>
      result.diagnoses.map((diagnosis) => ({
        brand: {
          name: input.name,
          domain: input.domain,
          category: input.category ?? null,
          description: input.description ?? null,
          target_persona: input.persona ?? null,
        },
        diagnosis,
        competitors: (input.competitors ?? []).map((name) => ({ name, domain: null })),
      })),
    ),
  );

  return summarizeScan(input, promptResults, fixes);
}

export function summarizeScan(
  input: CliBrandInput,
  promptResults: ScanPromptResult[],
  fixes: GeneratedFix[],
): ScanSummary {
  const statusAverage =
    promptResults.reduce((sum, result) => sum + STATUS_WEIGHTS[result.score.recommendation_status], 0) /
    Math.max(promptResults.length, 1);
  const averageCitationSharePct = Math.round(
    (promptResults.reduce((sum, result) => sum + result.score.citation_share, 0) / Math.max(promptResults.length, 1)) * 100,
  );
  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(statusAverage * 0.72 + averageCitationSharePct * 0.28)),
  );
  const missingPromptCount = promptResults.filter((result) => !result.score.brand_mentioned).length;
  const topCompetitor =
    Object.entries(
      promptResults.flatMap((result) => result.score.competitor_citations).reduce<Record<string, number>>((acc, competitor) => {
        acc[competitor] = (acc[competitor] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  const engineCoverage = Object.values(
    promptResults
      .flatMap((result) =>
        result.runs.map((run) => ({
          engine: run.engine,
          mentioned: run.extraction.brands_mentioned.some(
            (brand: string) => brand.toLowerCase() === input.name.toLowerCase(),
          ),
        })),
      )
      .reduce<Record<string, { engine: string; hits: number }>>((acc, item) => {
        const current = acc[item.engine] ?? { engine: item.engine, hits: 0 };
        current.hits += item.mentioned ? 1 : 0;
        acc[item.engine] = current;
        return acc;
      }, {}),
  ).map((item) => ({
    engine: item.engine,
    coveragePct: Math.round((item.hits / Math.max(promptResults.length, 1)) * 100),
  }));

  const recommendedFixes = Array.from(new Set(fixes.map((fix) => fix.title))).slice(0, 4);
  const recommendationStatus =
    promptResults[0]?.score.recommendation_status ??
    ("unanswerable" satisfies VisibilityScore["recommendation_status"]);

  return {
    command: `citekit scan --domain ${input.domain}${input.competitors?.[0] ? ` --competitor ${input.competitors[0]}` : ""} --prompt-count ${promptResults.length}`,
    promptCount: promptResults.length,
    engineCount: engineCoverage.length,
    totalRuns: promptResults.reduce((sum, result) => sum + result.runs.length, 0),
    overallScore,
    recommendationStatus,
    averageCitationSharePct,
    missingPromptCount,
    topCompetitor,
    engineCoverage,
    recommendedFixes,
    prompts: promptResults,
    fixes,
  };
}

export function renderScanReport(summary: ScanSummary): string {
  const lines = [
    chalk.bold("CiteKit OSS"),
    summary.command,
    "",
    `${chalk.green("Scanned")} ${summary.totalRuns} prompt-engine pairs across ${summary.engineCount} AI surfaces`,
    "",
    chalk.bold("AI Visibility Score"),
    `${chalk.green(summary.overallScore.toString())}/100  ${summary.recommendationStatus.replace("_", " ").toUpperCase()}`,
    "",
    "Engine coverage",
    ...summary.engineCoverage.map(
      (engine) => `${engine.engine.padEnd(12, " ")} ${`${engine.coveragePct}%`.padStart(4, " ")}`,
    ),
    "",
    `Missing from ${summary.missingPromptCount} of ${summary.promptCount} prompts`,
    `Average citation share ${summary.averageCitationSharePct}%`,
    `Top competitor ${summary.topCompetitor ?? "not detected"}`,
    "",
    "Recommended fixes",
    ...summary.recommendedFixes.map((fix) => `-> ${fix}`),
  ];

  return `${lines.join("\n")}\n`;
}

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function printHeading(title: string): void {
  process.stdout.write(`${chalk.bold(title)}\n`);
}

export function renderScore(
  input: CliBrandInput,
  extraction: Awaited<ReturnType<typeof runSinglePromptProbe>>["runs"][number]["extraction"],
) {
  return scoreExtraction(
    { name: input.name, domain: input.domain },
    (input.competitors ?? []).map((name) => ({ name, domain: null })),
    extraction,
  );
}
