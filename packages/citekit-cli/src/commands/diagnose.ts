import { Command } from "commander";
import ora from "ora";
import {
  addBrandOptions,
  addExamples,
  addJsonOption,
  printHeading,
  printJson,
  providerCommandNote,
  runDiagnosis,
  toCliBrandInput,
} from "./shared";

export const diagnoseCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("diagnose")
        .summary("Explain why a brand is winning or losing")
        .description("Run a probe and heuristic diagnosis for a brand")
        .option("--prompt <prompt>", "Override the generated prompt"),
    ),
  ).action(async (options) => {
    const spinner = ora("Running diagnosis").start();
    const diagnoses = await runDiagnosis(toCliBrandInput(options), options.prompt);
    spinner.succeed("Diagnosis completed");

    if (options.json) {
      printJson(diagnoses);
      return;
    }

    printHeading("Diagnosis");
    for (const gap of diagnoses) {
      process.stdout.write(`- [${gap.severity}] ${gap.issue_type}: ${gap.explanation}\n`);
    }
  }),
  [
    'citekit diagnose --name "CiteOps" --domain citeops.ai --competitor "Profound"',
    'citekit diagnose --name "CiteOps" --domain citeops.ai --prompt "best ai visibility platform" --json',
  ],
  providerCommandNote(),
);
