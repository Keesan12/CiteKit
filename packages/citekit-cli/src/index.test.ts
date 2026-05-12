import { describe, expect, it } from "vitest";
import { buildProgram } from "./index";

function renderHelp(command: { configureOutput: (output: { writeOut: (value: string) => void; writeErr: (value: string) => void }) => void; outputHelp: () => void; }): string {
  let output = "";
  command.configureOutput({
    writeOut: (value) => {
      output += value;
    },
    writeErr: (value) => {
      output += value;
    },
  });
  command.outputHelp();
  return output;
}

describe("buildProgram", () => {
  it("shows quick-start examples in root help", () => {
    const help = renderHelp(buildProgram());

    expect(help).toContain("Examples:");
    expect(help).toContain("citekit doctor");
    expect(help).toContain("citekit scan --name");
  });

  it("shows concrete scan examples in subcommand help", () => {
    const scanCommand = buildProgram().commands.find((command) => command.name() === "scan");
    expect(scanCommand).toBeDefined();

    const scanHelp = renderHelp(scanCommand!);

    expect(scanHelp).toContain("Examples:");
    expect(scanHelp).toContain("--prompt-count");
    expect(scanHelp).toContain("citekit scan --name");
  });
});
