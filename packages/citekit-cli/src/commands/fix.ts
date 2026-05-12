import { Command } from "commander";
import ora from "ora";
import {
  addBrandOptions,
  addExamples,
  addJsonOption,
  printHeading,
  printJson,
  providerCommandNote,
  runFixGeneration,
  toCliBrandInput,
} from "./shared";

export const fixCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("fix")
        .summary("Generate draft fixes from live diagnosis")
        .description("Generate fix drafts from a live probe + diagnosis run")
        .option("--prompt <prompt>", "Override the generated prompt"),
    ),
  ).action(async (options) => {
    const spinner = ora("Generating fixes").start();
    const fixes = await runFixGeneration(toCliBrandInput(options), options.prompt);
    spinner.succeed("Fixes generated");

    if (options.json) {
      printJson(fixes);
      return;
    }

    printHeading("Generated Fixes");
    for (const fix of fixes) {
      process.stdout.write(`- ${fix.fix_type}: ${fix.title}\n`);
    }
  }),
  [
    'citekit fix --name "CiteOps" --domain citeops.ai --competitor "Profound"',
    'citekit fix --name "CiteOps" --domain citeops.ai --prompt "best ai visibility platform" --json',
  ],
  providerCommandNote(),
);
