import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import {
  benchmarkFoundationBatch,
  getScoreboardPreset,
  type BenchmarkTarget,
  type ScoreboardPreset,
} from "citekit-core";
import { addExamples, parsePositiveIntegerOption, printHeading, printJson } from "./shared";

function parseBenchmarkPreset(value: string | undefined): ScoreboardPreset {
  if (value === undefined || value === "founders" || value === "market") {
    return (value ?? "founders") as ScoreboardPreset;
  }

  throw new Error(`\`--preset\` must be either "founders" or "market". Received "${value}".`);
}

function summarizeTargets(results: Awaited<ReturnType<typeof benchmarkFoundationBatch>>) {
  return results.map((result, index) => ({
    rank: index + 1,
    name: result.name,
    domain: result.domain,
    overall: result.scores.overall,
    agent_readiness: result.scores.agent_readiness,
    decision_surface: result.scores.decision_surface,
    trust_density: result.scores.trust_density,
    status: result.status,
  }));
}

export const benchmarkCommand = addExamples(
  new Command("benchmark")
    .summary("Benchmark crawl-based AEO foundation metrics")
    .description("Run a real crawl-based AEO foundation benchmark across a founder or market preset")
    .option("--preset <preset>", 'Preset to benchmark ("founders" or "market")', "founders")
    .option("--max-pages <count>", "Maximum pages to sample per site", "5")
    .option("--concurrency <count>", "Concurrent domain crawls", "4")
    .option("--output <path>", "Optional file path to write the JSON output")
    .option("--json", "Print full JSON output")
    .showHelpAfterError()
    .action(async (options) => {
      const preset = parseBenchmarkPreset(options.preset);
      const maxPages = parsePositiveIntegerOption(options.maxPages, "--max-pages", 5);
      const concurrency = parsePositiveIntegerOption(options.concurrency, "--concurrency", 4);
      const targets = getScoreboardPreset(preset) as readonly BenchmarkTarget[];

      const spinner = ora(`Benchmarking ${targets.length} domains from the ${preset} preset`).start();
      const results = await benchmarkFoundationBatch(targets, {
        maxPages,
        concurrency,
      });
      spinner.succeed(`Benchmarked ${results.length} domains`);

      const payload = {
        generatedAt: new Date().toISOString(),
        preset,
        targetCount: targets.length,
        results,
      };

      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      }

      if (options.json) {
        printJson(payload);
        return;
      }

      printHeading("AEO Foundation Scoreboard");
      for (const row of summarizeTargets(results).slice(0, 20)) {
        process.stdout.write(
          `- #${row.rank} ${row.name} (${row.domain}) overall=${row.overall} agent=${row.agent_readiness} decision=${row.decision_surface} trust=${row.trust_density} status=${row.status}\n`,
        );
      }

      if (options.output) {
        process.stdout.write(`\nSaved full benchmark JSON to ${path.resolve(options.output)}\n`);
      }
    }),
  [
    "citekit benchmark --preset founders --max-pages 3",
    "citekit benchmark --preset market --concurrency 2 --output docs/benchmarks/market.json --json",
  ],
);
