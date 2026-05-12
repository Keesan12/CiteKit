import { Command } from "commander";
import ora from "ora";
import {
  checkIntegrationReadiness,
  type IntegrationReadinessReport,
  type IntegrationReadinessStatus,
} from "../../../citekit-core/src/integrations/readiness";
import {
  createReadOnlyIntegrationProbes,
  type ReadOnlyIntegrationProbeOptions,
} from "../../../citekit-core/src/integrations/readiness-probes";
import { addExamples, addJsonOption, printJson } from "./shared";

const STATUS_ORDER: IntegrationReadinessStatus[] = ["ready", "unverified", "missing", "blocked", "invalid"];

export interface RunDoctorCommandOptions {
  live?: boolean;
  probeOptions?: ReadOnlyIntegrationProbeOptions;
}

export async function runDoctorCommand(
  env: Record<string, string | undefined> = process.env,
  options: RunDoctorCommandOptions = {},
) {
  return checkIntegrationReadiness({
    env,
    probes: options.live ? createReadOnlyIntegrationProbes(options.probeOptions) : undefined,
  });
}

export function renderDoctorReport(report: IntegrationReadinessReport): string {
  const lines = [
    "CiteKit Integration Doctor",
    `Overall status: ${report.status.toUpperCase()}`,
    "",
  ];

  for (const status of STATUS_ORDER) {
    const entries = Object.values(report.integrations).filter((integration) => integration.status === status);
    if (entries.length === 0) {
      continue;
    }

    lines.push(`${status.toUpperCase()}`);
    for (const entry of entries) {
      const firstBlocker = entry.blockers[0] ? ` — ${entry.blockers[0]}` : "";
      const firstEvidence = entry.probeEvidence[0] ? ` [probe: ${entry.probeEvidence[0].detail}]` : "";
      lines.push(`- ${entry.integration}: ${entry.summary}${firstBlocker}${firstEvidence}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export const doctorCommand = addExamples(
  addJsonOption(
    new Command("doctor")
      .summary("Audit provider and integration readiness")
      .description("Check credential readiness for production integrations without leaking secrets")
      .option("--live", "Run opt-in read-only live probes against configured providers"),
  ).action(async (options) => {
    const spinner = options.json
      ? null
      : ora(options.live ? "Checking integration readiness and live probes" : "Checking integration readiness").start();
    const report = await runDoctorCommand(process.env, { live: Boolean(options.live) });
    spinner?.succeed("Integration readiness checked");

    if (options.json) {
      printJson(report);
      return;
    }

    process.stdout.write(renderDoctorReport(report));
  }),
  ["citekit doctor", "citekit doctor --json", "citekit doctor --live --json"],
  "This command only reports masked credential readiness and probe status. It never prints raw secrets or persists credentials.",
);
