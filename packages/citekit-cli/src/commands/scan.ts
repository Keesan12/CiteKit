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
} from "./shared";

export const scanCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("scan")
        .summary("Run the full visibility scan")
        .description("Run the full CiteKit OSS scan flow across prompts, providers, diagnosis, and fixes")
        .option("--prompt <prompt>", "Override the generated prompt set with one prompt")
        .option("--prompt-count <count>", "Prompt count when generating prompts", "5"),
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

      if (options.json) {
        printJson(summary);
        return;
      }

      process.stdout.write(renderScanReport(summary));
    }),
  [
    'citekit scan --name "CiteOps" --domain citeops.ai --competitor "Profound" "Peec AI"',
    'citekit scan --name "CiteOps" --domain https://citeops.ai --prompt "best ai visibility platform" --json',
  ],
  providerCommandNote(),
);
