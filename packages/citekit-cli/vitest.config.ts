import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "citekit-core": path.resolve(__dirname, "../citekit-core/src/index.ts"),
    },
  },
});
