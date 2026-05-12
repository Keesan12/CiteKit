import { describe, expect, it } from "vitest";
import {
  findForbiddenPackageDependencies,
  findForbiddenSpecifiers,
  isForbiddenSpecifier,
} from "./check-public-oss-boundary.mjs";

describe("isForbiddenSpecifier", () => {
  it("flags private app and runtime package imports", () => {
    expect(isForbiddenSpecifier("apps/citeops-app/lib/server")).toBe(true);
    expect(isForbiddenSpecifier("martinloop-private")).toBe(true);
    expect(isForbiddenSpecifier("trace-intelligence/private")).toBe(true);
  });

  it("allows public citekit imports", () => {
    expect(isForbiddenSpecifier("citekit-core")).toBe(false);
    expect(isForbiddenSpecifier("./commands/shared")).toBe(false);
  });
});

describe("findForbiddenSpecifiers", () => {
  it("finds restricted import styles in source text", () => {
    const source = `
      import { x } from "martinloop-private";
      export * from "../../apps/citeops-cloud/api";
      const helper = await import("sansa-private");
    `;

    expect(findForbiddenSpecifiers(source)).toEqual([
      "martinloop-private",
      "../../apps/citeops-cloud/api",
      "sansa-private",
    ]);
  });
});

describe("findForbiddenPackageDependencies", () => {
  it("finds private packages in manifest dependency sections", () => {
    expect(
      findForbiddenPackageDependencies({
        dependencies: {
          "citekit-core": "*",
          "trace-intelligence-private": "workspace:*",
        },
        devDependencies: {
          vitest: "^3.2.4",
          "martinloop-private": "workspace:*",
        },
      }),
    ).toEqual([
      { dependencyName: "trace-intelligence-private", section: "dependencies" },
      { dependencyName: "martinloop-private", section: "devDependencies" },
    ]);
  });
});
