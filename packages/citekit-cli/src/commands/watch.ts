import { Command } from "commander";
import ora from "ora";
import {
  addBrandOptions,
  addExamples,
  parsePositiveIntegerOption,
  providerCommandNote,
  runScan,
  toCliBrandInput,
  type CliBrandInput,
  type ScanSummary,
} from "./shared";

function diffScores(prev: ScanSummary, next: ScanSummary): string[] {
  const lines: string[] = [];
  const delta = next.overallScore - prev.overallScore;
  if (delta !== 0) {
    const sign = delta > 0 ? "+" : "";
    lines.push(`Overall: ${prev.overallScore} → ${next.overallScore} (${sign}${delta})`);
  }
  const citationDelta = Math.round(next.averageCitationSharePct - prev.averageCitationSharePct);
  if (citationDelta !== 0) {
    const sign = citationDelta > 0 ? "+" : "";
    lines.push(`Citation share: ${prev.averageCitationSharePct}% → ${next.averageCitationSharePct}% (${sign}${citationDelta}pp)`);
  }
  if (lines.length === 0) lines.push("No change detected.");
  return lines;
}

function formatScanSummary(report: ScanSummary): string {
  const lines = [
    `Score: ${report.overallScore}/100`,
    `Citation share: ${report.averageCitationSharePct}%`,
  ];
  const topFix = report.recommendedFixes[0];
  if (topFix) lines.push(`Top fix: ${topFix}`);
  return lines.join("  |  ");
}

async function runWatchLoop(input: CliBrandInput, options: {
  intervalMin: number;
  promptCount: number;
}): Promise<void> {
  const intervalMs = options.intervalMin * 60 * 1000;
  let prev: ScanSummary | null = null;
  let iteration = 0;

  const formatTs = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  process.stdout.write(
    `CiteKit Watch — monitoring ${input.domain} every ${options.intervalMin} min\n` +
    `Press Ctrl+C to stop.\n\n`,
  );

  while (true) {
    iteration++;
    const spinner = ora(`[${formatTs()}] Running scan #${iteration}…`).start();

    try {
      const report = await runScan(input, { promptCount: options.promptCount });
      spinner.succeed(`[${formatTs()}] Scan #${iteration} done  —  ${formatScanSummary(report)}`);

      if (prev) {
        const diff = diffScores(prev, report);
        process.stdout.write(`  Δ ${diff.join("  |  ")}\n`);
      }
      prev = report;
    } catch (err) {
      spinner.fail(`[${formatTs()}] Scan #${iteration} failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    process.stdout.write(`\n  Next run in ${options.intervalMin} min. Ctrl+C to exit.\n\n`);
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}

export const watchCommand = addExamples(
  addBrandOptions(
    new Command("watch")
      .summary("Poll citation visibility on a schedule (OSS loop mode)")
      .description(
        "Run citekit scan repeatedly on an interval and print score diffs.\n" +
        "This is the OSS autonomous watch mode — no account required.\n" +
        "Upgrade to CiteOps Cloud for persistent monitoring, GitHub PRs, and proof cards.",
      )
      .option("--interval <minutes>", "Polling interval in minutes", "30")
      .option("--prompt-count <count>", "Number of prompts per scan", "5"),
  )
    .action(async (options) => {
      const input = toCliBrandInput(options);
      const intervalMin = parsePositiveIntegerOption(options.interval, "--interval", 30);
      const promptCount = parsePositiveIntegerOption(options.promptCount, "--prompt-count", 5);

      await runWatchLoop(input, { intervalMin, promptCount });
    }),
  [
    'citekit watch --name "CiteOps" --domain citeops.ai --interval 30',
    'citekit watch --name "CiteOps" --domain citeops.ai --competitor "Profound" --interval 60 --prompt-count 8',
  ],
  providerCommandNote(),
);
