#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { benchmarkCommand } from "./commands/benchmark";
import { doctorCommand } from "./commands/doctor";
import { diagnoseCommand } from "./commands/diagnose";
import { fixCommand } from "./commands/fix";
import { generateCommand } from "./commands/generate";
import { monitorCommand } from "./commands/monitor";
import { probeCommand } from "./commands/probe";
import { scanCommand } from "./commands/scan";
import { scoreCommand } from "./commands/score";
import { voiceCommand } from "./commands/voice";
import { watchCommand } from "./commands/watch";
import { buildExamplesHelp, formatCliError } from "./commands/shared";

export function buildProgram(): Command {
  return new Command()
    .name("citekit")
    .description("CiteKit OSS CLI — AI citation scanner, monitoring, diagnosis, and fix generation")
    .version("0.1.0")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .addHelpText(
      "after",
      buildExamplesHelp(
        [
          'citekit doctor',
          'citekit scan --name "CiteOps" --domain citeops.ai --competitor "Profound"',
          'citekit monitor --name "CiteOps" --domain citeops.ai --prompt-count 8',
          "citekit benchmark --preset founders --max-pages 3 --output docs/benchmarks/founders.json",
        ],
        "Provider-backed commands (`scan`, `monitor`, `probe`, `diagnose`, `fix`, `score`) require at least one configured provider API key in the environment.",
      ),
    )
    .addCommand(scanCommand)
    .addCommand(watchCommand)
    .addCommand(monitorCommand)
    .addCommand(doctorCommand)
    .addCommand(benchmarkCommand)
    .addCommand(probeCommand)
    .addCommand(diagnoseCommand)
    .addCommand(fixCommand)
    .addCommand(scoreCommand)
    .addCommand(generateCommand)
    .addCommand(voiceCommand);
}

export async function runCli(argv = process.argv): Promise<void> {
  await buildProgram().parseAsync(argv);
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  void runCli().catch((error) => {
    process.stderr.write(`${formatCliError(error)}\n`);
    process.exitCode = 1;
  });
}
