import { Command } from "commander";
import ora from "ora";
import {
  addBrandOptions,
  addExamples,
  addJsonOption,
  printHeading,
  printJson,
  providerCommandNote,
  renderScore,
  runSinglePromptProbe,
  toCliBrandInput,
} from "./shared";

export const scoreCommand = addExamples(
  addJsonOption(
    addBrandOptions(
      new Command("score")
        .summary("Compute recommendation status from a live probe")
        .description("Run a live probe and compute the recommendation score")
        .option("--prompt <prompt>", "Override the generated prompt"),
    ),
  ).action(async (options) => {
    const spinner = ora("Scoring probe").start();
    const input = toCliBrandInput(options);
    const probe = await runSinglePromptProbe(input, options.prompt);
    spinner.succeed("Score computed");
    const firstRun = probe.runs[0];
    if (!firstRun) {
      throw new Error("Probe completed without any provider runs.");
    }
    const score = renderScore(input, firstRun.extraction);

    if (options.json) {
      printJson(score);
      return;
    }

    printHeading("Visibility Score");
    process.stdout.write(
      `- status: ${score.recommendation_status}\n- cited: ${score.brand_cited}\n- mentioned: ${score.brand_mentioned}\n- citation_share: ${score.citation_share}\n`,
    );
  }),
  [
    'citekit score --name "CiteOps" --domain citeops.ai --competitor "Profound"',
    'citekit score --name "CiteOps" --domain citeops.ai --prompt "best ai visibility platform" --json',
  ],
  providerCommandNote(),
);
