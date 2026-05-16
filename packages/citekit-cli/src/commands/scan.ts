import { Command } from "commander";
import ora from "ora";
import {
  addBrandOptions,
  addExamples,
  addJsonOption,
  parsePositiveIntegerOption,
  printJson,
  providerCommandNote,
  renderScanReport,
  runScan,
  toCliBrandInput,
  type ScanSummary,
} from "./shared";

function buildAgentOutput(summary: ScanSummary): Record<string, unknown> {
  return {
    schema_version: "citekit/agent/v1",
    scan_at: new Date().toISOString(),
    brand: summary.command.split("--domain ")[1]?.split(" ")[0] ?? "unknown",
    overall_score: summary.overallScore,
    recommendation_status: summary.recommendationStatus,
    citation_share_pct: summary.averageCitationSharePct,
    missing_from_prompts: summary.missingPromptCount,
    top_competitor: summary.topCompetitor,
    engine_coverage: summary.engineCoverage,
    eeat_gaps: summary.eeatSignals
      .filter((s) => s.status !== "pass")
      .map((s) => ({ label: s.label, status: s.status, fix: s.fix })),
    agent_actions: summary.agentActions,
    upgrade_url: "https://citeops.ai/upgrade",
  };
}

async function pushToCloud(summary: ScanSummary, apiKey: string): Promise<void> {
  const baseUrl = process.env.CITEOPS_API_URL ?? "https://citeops.lovable.app";
  const res = await fetch(`${baseUrl}/api/public/scan-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(summary),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`CiteOps Cloud rejected the result (HTTP ${res.status}). Check your CITEOPS_API_KEY.`);
  }
}

export const scanCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("scan")
        .summary("Run the full visibility scan")
        .description("Run the full CiteKit OSS scan flow across prompts, providers, diagnosis, and fixes")
        .option("--prompt <prompt>", "Override the generated prompt set with one prompt")
        .option("--prompt-count <count>", "Prompt count when generating prompts", "5")
        .option("--cloud", "Push scan result to CiteOps Cloud for persistence (requires CITEOPS_API_KEY)")
        .option("--agent", "Output machine-readable agent_actions JSON for automated fix pipelines"),
    ),
  )
    .action(async (options) => {
      const spinner = ora("Running CiteKit scan").start();
      const summary = await runScan(
        toCliBrandInput(options),
        {
          promptOverride: options.prompt,
          promptCount: parsePositiveIntegerOption(options.promptCount, "--prompt-count", 5),
        },
      );
      spinner.succeed("Scan completed");

      const apiKey = process.env.CITEOPS_API_KEY;
      if (options.cloud || apiKey) {
        if (!apiKey) {
          process.stderr.write("Warning: --cloud flag requires CITEOPS_API_KEY env var. Skipping cloud push.\n");
        } else {
          const cloudSpinner = ora("Pushing result to CiteOps Cloud…").start();
          try {
            await pushToCloud(summary, apiKey);
            cloudSpinner.succeed("Result saved to CiteOps Cloud. View your dashboard at citeops.lovable.app");
          } catch (err) {
            cloudSpinner.fail(`Cloud push failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      if (options.agent) {
        printJson(buildAgentOutput(summary));
        return;
      }

      if (options.json) {
        printJson(summary);
        return;
      }

      process.stdout.write(renderScanReport(summary));
    }),
  [
    'citekit scan --name "CiteOps" --domain citeops.ai --competitor "Profound" "Peec AI"',
    'citekit scan --name "CiteOps" --domain https://citeops.ai --prompt "best ai visibility platform" --json',
    'CITEOPS_API_KEY=sk-... citekit scan --name "CiteOps" --domain citeops.ai --cloud',
    'citekit scan --name "CiteOps" --domain citeops.ai --agent',
  ],
  providerCommandNote(),
);
