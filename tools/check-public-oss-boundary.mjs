import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_PACKAGE_DIRS = ["packages/citekit-cli", "packages/citekit-core"];

const IMPORT_SPECIFIER_PATTERNS = [
  /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
  /\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  /\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
];

const FORBIDDEN_SPECIFIER_PATTERNS = [
  /(^|\/)apps\/(?:citeops-app|citeops-cloud|cited-app)(?:\/|$)/,
  /(^|\/)(?:citeops-app|citeops-cloud|cited-app)(?:\/|$)/,
  /(^|\/)(?:trace-intelligence|trace-intelligence-private)(?:\/|$)/,
  /(^|\/)martin-loop\/private(?:\/|$)/,
  /(^|\/)martinloop-private(?:\/|$)/,
  /(^|\/)(?:sansa|sansa-private)(?:\/|$)/,
];

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".json"]);
const PACKAGE_JSON_KEYS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

function normalizeSpecifier(specifier) {
  return specifier.replace(/\\/g, "/");
}

export function isForbiddenSpecifier(specifier) {
  const normalized = normalizeSpecifier(specifier);
  return FORBIDDEN_SPECIFIER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function findForbiddenSpecifiers(sourceText) {
  const matches = [];

  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    for (const match of sourceText.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier && isForbiddenSpecifier(specifier)) {
        matches.push(specifier);
      }
    }
  }

  return Array.from(new Set(matches));
}

export function findForbiddenPackageDependencies(packageJson) {
  const violations = [];

  for (const key of PACKAGE_JSON_KEYS) {
    const section = packageJson[key];
    if (!section || typeof section !== "object") {
      continue;
    }

    for (const dependencyName of Object.keys(section)) {
      if (isForbiddenSpecifier(dependencyName)) {
        violations.push({ dependencyName, section: key });
      }
    }
  }

  return violations;
}

async function listFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function scanPublicBoundary(repoRoot) {
  const violations = [];
  let fileCount = 0;

  for (const packageDir of PUBLIC_PACKAGE_DIRS) {
    const absoluteDir = path.join(repoRoot, packageDir);
    const files = await listFiles(absoluteDir);

    for (const absoluteFile of files) {
      const relativeFile = path.relative(repoRoot, absoluteFile).replace(/\\/g, "/");
      const sourceText = await fs.readFile(absoluteFile, "utf8");
      fileCount += 1;

      if (path.basename(absoluteFile) === "package.json") {
        const packageJson = JSON.parse(sourceText);
        for (const violation of findForbiddenPackageDependencies(packageJson)) {
          violations.push({
            file: relativeFile,
            type: "dependency",
            specifier: violation.dependencyName,
            detail: violation.section,
          });
        }
        continue;
      }

      for (const specifier of findForbiddenSpecifiers(sourceText)) {
        violations.push({
          file: relativeFile,
          type: "import",
          specifier,
        });
      }
    }
  }

  return { fileCount, violations };
}

function renderViolation(violation) {
  if (violation.type === "dependency") {
    return `- ${violation.file}: dependency "${violation.specifier}" declared in ${violation.detail}`;
  }

  return `- ${violation.file}: forbidden import "${violation.specifier}"`;
}

export async function runBoundaryCheck(repoRoot = process.cwd()) {
  const report = await scanPublicBoundary(repoRoot);

  if (report.violations.length === 0) {
    process.stdout.write(
      `Boundary OK: scanned ${report.fileCount} files in ${PUBLIC_PACKAGE_DIRS.join(", ")} without private imports or dependencies.\n`,
    );
    return report;
  }

  process.stderr.write("Public OSS boundary violations found:\n");
  for (const violation of report.violations) {
    process.stderr.write(`${renderViolation(violation)}\n`);
  }
  process.exitCode = 1;
  return report;
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  await runBoundaryCheck();
}
