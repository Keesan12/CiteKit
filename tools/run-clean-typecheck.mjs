import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const tsbuildinfoPath = path.join(cwd, "tsconfig.tsbuildinfo");

try {
  rmSync(tsbuildinfoPath, { force: true });
} catch {
  // Ignore cleanup failures and let tsc surface real errors.
}

const child = spawn("tsc --noEmit", [], {
  cwd,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
