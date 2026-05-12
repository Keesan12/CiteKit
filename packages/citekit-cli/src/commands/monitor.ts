import { Command } from "commander";
import ora from "ora";
import {
  createProbeProviders,
  generatePrompts,
  runCitationMonitoring,
  type CitationMonitoringReport,
} from "citekit-core";
import {
  addBrandOptions,
  addExamples,
  addJsonOption,
  parsePositiveIntegerOption,
  printJson,
  providerCommandNote,
  toBrandSeed,
  toCliBrandInput,
  type CliBrandInput,
} from "./shared";

function toMonitorBrand(input: CliBrandInput) {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    domain: input.domain,
    category: input.category ?? null,
    description: input.description ?? null,
    target_persona: input.persona ?? null,
  };
}

export async function runMonitoringCommand(
  input: CliBrandInput,
  options: {
    promptCount?: number;
    promptOverride?: string;
  } = {},
): Promise<CitationMonitoringReport> {
  const providers = createProbeProviders();
  if (providers.length === 0) {
    throw new Error("No probe providers are configured. Add at least one provider API key to your environment.");
  }

  const prompts = options.promptOverride
    ? [{ prompt_text: options.promptOverride, intent_type: "best_tool" as const, buyer_stage: null, priority: 10 }]
    : generatePrompts(toBrandSeed(input), options.promptCount ?? 5);

  return runCitationMonitoring({
    brand: toMonitorBrand(input),
    competitors: (input.competitors ?? []).map((name) => ({ name, domain: null })),
    prompts,
    providers,
  });
}

export function renderMonitoringReport(report: CitationMonitoringReport): string {
  const lines = [
    "CiteKit WF-18 Monitor",
    `Generated ${report.generatedAt}`,
    "",
    `Prompt panel: ${report.promptCount} prompts x ${report.providerCount} providers`,
    `Runs: ${report.successfulRunCount} successful, ${report.failedRunCount} failed`,
    "",
    "Share of answer",
    `Mention rate: ${Math.round(report.snapshot.brandMentionRate * 100)}%`,
    `Citation rate: ${Math.round(report.snapshot.brandCitationRate * 100)}%`,
    `Average citation share: ${Math.round(report.snapshot.averageCitationShare * 100)}%`,
    `Confidence: ${Math.round(report.snapshot.confidence * 100)}%`,
    `Volatility: ${Math.round(report.snapshot.volatility * 100)}%`,
    "",
    "Top routes",
    ...report.routes.slice(0, 5).map((route) => `-> ${route.workflowId}: ${route.reason}`),
  ];

  return `${lines.join("\n")}\n`;
}

export const monitorCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("monitor")
        .summary("Track share-of-answer across providers")
        .description("Run WF-18 citation monitoring across prompt-engine panels")
        .option("--prompt <prompt>", "Override the generated prompt set with one prompt")
        .option("--prompt-count <count>", "Prompt count when generating prompts", "5"),
    ),
  ).action(async (options) => {
    const spinner = options.json ? null : ora("Running WF-18 citation monitor").start();
    const report = await runMonitoringCommand(
      toCliBrandInput(options),
      {
        promptOverride: options.prompt,
        promptCount: parsePositiveIntegerOption(options.promptCount, "--prompt-count", 5),
      },
    );
    spinner?.succeed("Monitoring completed");

    if (options.json) {
      printJson(report);
      return;
    }

    process.stdout.write(renderMonitoringReport(report));
  }),
  [
    'citekit monitor --name "CiteOps" --domain citeops.ai --competitor "Profound"',
    'citekit monitor --name "CiteOps" --domain citeops.ai --prompt-count 8 --json',
  ],
  providerCommandNote(),
);
