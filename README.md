# CiteKit

Open-source AI visibility tooling for teams that want to understand whether answer engines can crawl, cite, and recommend their brand.

CiteKit is the free developer and growth-team hook for the CiteOps ecosystem. It gives you local, reproducible scans for SEO, AEO, GEO, local, and voice-search readiness. CiteOps Cloud is the paid autonomous operator that turns those findings into scheduled monitoring, PR/CMS drafts, verification loops, proof cards, and TraceIntelligence.

## What CiteKit Does

- Scans a brand/domain against live provider probes when keys are available.
- Benchmarks crawl-based AI-readiness signals such as `llms.txt`, `robots.txt`, sitemap, schema, canonical coverage, pricing/docs/comparison pages, freshness, author signals, and stats.
- Monitors share-of-answer style visibility across prompt/provider panels.
- Diagnoses why a brand is losing AI recommendations.
- Generates safe fix recommendations for answer-first content, schema, `llms.txt`, proof pages, comparison pages, and crawlability gaps.
- Checks provider/integration readiness without printing raw secrets.

## Install

```bash
npm install -g citekit-cli
```

Or run from source:

```bash
git clone https://github.com/Keesan12/CiteKit.git
cd CiteKit
npm install
npm run build
node packages/citekit-cli/dist/index.mjs --help
```

## Quick Start

```bash
citekit doctor
citekit benchmark --preset founders --max-pages 3 --json
citekit scan --name "Your Brand" --domain yourbrand.com --competitor "Competitor One" "Competitor Two"
citekit monitor --name "Your Brand" --domain yourbrand.com --prompt-count 8
```

Provider-backed commands use environment variables when available:

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
PERPLEXITY_API_KEY=
OPENROUTER_API_KEY=
```

Missing keys are reported as blockers. CiteKit does not fake provider results.

## Commands

- `citekit doctor`: Inspect provider and integration readiness with masked evidence.
- `citekit scan`: Run prompt generation, provider probes, diagnosis, and fix recommendations.
- `citekit monitor`: Measure prompt/provider visibility and routing signals.
- `citekit probe`: Run one prompt against configured providers.
- `citekit diagnose`: Explain why the brand is winning or losing.
- `citekit fix`: Generate safe fix drafts from diagnosis output.
- `citekit score`: Score citation/recommendation outcomes from probe output.
- `citekit benchmark`: Crawl preset domain sets and score answer-engine foundation readiness.

## Repository Structure

```text
packages/citekit-core   TypeScript primitives for crawl, probe, monitor, diagnose, fix, score, proof, and benchmark workflows
packages/citekit-cli    Public CLI wrapper around CiteKit core
examples                Copy-pasteable CLI and Node examples
docs                    User guides, upgrade path, and OSS boundary notes
tools                  Public boundary checks and repo utilities
```

## Examples

```bash
npm run verify
node packages/citekit-cli/dist/index.mjs doctor --json
node packages/citekit-cli/dist/index.mjs benchmark --preset market --concurrency 2 --max-pages 3 --json
```

```ts
import { benchmarkFoundation } from "citekit-core";

const result = await benchmarkFoundation({
  name: "Example",
  domain: "example.com",
});

console.log(result.scores.overall, result.topActions);
```

## OSS vs CiteOps Cloud

CiteKit is useful by itself: run local scans, benchmark your site, export JSON, and learn what answer engines can verify.

CiteOps Cloud is for teams that want the autonomous loop:

- Scheduled monitoring across ChatGPT/OpenAI, Claude, Gemini, Perplexity, Google surfaces, and OpenRouter-backed panels.
- Website-platform-aware onboarding for WordPress, WooCommerce, Shopify, Webflow, Wix, Squarespace, GoDaddy, Hostinger, Weebly/Square, custom code, and unknown/static sites.
- Approval-safe GitHub PRs and CMS drafts.
- Public proof cards and scoreboard pages.
- TraceIntelligence audit trails and hashed-only Sansa learning.

Start with CiteKit. Upgrade when you need the agent to keep watching, fixing, verifying, and proving outcomes.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
npm run boundary:public
```

## Public Boundary

This repo must stay OSS-safe. It must not import private CiteOps Hosted app/cloud/runtime code, credentials, customer data, internal specs, or private Sansa/TraceIntelligence implementations.

Run this before every release:

```bash
npm run boundary:public
```

## License

MIT
