import { Command } from "commander";
import ora from "ora";
import {
  addBrandOptions,
  addExamples,
  addJsonOption,
  printHeading,
  printJson,
  providerCommandNote,
  runSinglePromptProbe,
  toCliBrandInput,
} from "./shared";

export const probeCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("probe")
        .summary("Run one prompt across configured providers")
        .description("Run a real probe against configured LLM providers")
        .option("--prompt <prompt>", "Override the generated prompt"),
    ),
  ).action(async (options) => {
    const spinner = ora("Running probe").start();
    const result = await runSinglePromptProbe(toCliBrandInput(options), options.prompt);
    spinner.succeed("Probe completed");

    if (options.json) {
      printJson(result);
      return;
    }

    printHeading("Probe Summary");
    for (const run of result.runs) {
      process.stdout.write(
        `- ${run.engine}: ${run.model}\n  cited=${run.extraction.brands_cited.join(", ") || "none"}\n  winner=${run.extraction.recommendation_winner ?? "none"}\n`,
      );
    }
  }),
  [
    'citekit probe --name "CiteOps" --domain citeops.ai --prompt "best ai visibility platform"',
    'citekit probe --name "CiteOps" --domain citeops.ai --competitor "Profound" --json',
  ],
  providerCommandNote(),
);
