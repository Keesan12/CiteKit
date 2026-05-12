const path = require("node:path");

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: path.join(__dirname, "tsconfig.json"),
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  settings: {
    "import/resolver": {
      typescript: {
        project: path.join(__dirname, "tsconfig.json"),
      },
    },
  },
  ignorePatterns: ["dist", ".next", "node_modules", "coverage"],
  rules: {
    "import/no-unresolved": "error",
    "import/no-cycle": "error",
    "no-console": ["error", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      files: [
        "packages/citekit-core/**/*.{ts,tsx}",
        "packages/citekit-cli/**/*.{ts,tsx}",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "apps/citeops-app/**",
                  "apps/citeops-cloud/**",
                  "apps/cited-app/**",
                  "**/citeops-app/**",
                  "**/citeops-cloud/**",
                  "**/cited-app/**",
                  "citeops-app",
                  "citeops-app/*",
                  "citeops-cloud",
                  "citeops-cloud/*",
                  "**/martin-loop/private/**",
                  "**/trace-intelligence/**",
                  "trace-intelligence",
                  "trace-intelligence/*",
                  "trace-intelligence-private",
                  "trace-intelligence-private/*",
                  "martin-loop/private",
                  "martin-loop/private/*",
                  "martinloop-private",
                  "martinloop-private/*",
                  "sansa",
                  "sansa/*",
                  "sansa-private",
                  "sansa-private/*",
                ],
                message: "Public packages may not import private Martin Loop modules.",
              }
            ],
          },
        ],
      },
    },
  ],
};
