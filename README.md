# CiteKit

[![npm](https://img.shields.io/npm/v/citekit-cli?label=citekit-cli&color=2563eb)](https://www.npmjs.com/package/citekit-cli)
[![npm](https://img.shields.io/npm/v/citekit-core?label=citekit-core&color=2563eb)](https://www.npmjs.com/package/citekit-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-53%20passing-brightgreen)](packages/citekit-core)

**Open-source CLI to find out why ChatGPT, Claude, Perplexity, and Gemini aren't recommending your brand — and what to fix first.**

CiteKit scans your domain, probes live AI engines, diagnoses citation gaps, and generates ranked fixes. It's the free, local, self-hostable scanner that powers CiteOps Cloud.

> **Keywords**: AEO, GEO, AI citation, answer engine optimization, generative engine optimization, ChatGPT SEO, Perplexity SEO, llms.txt, AI visibility, brand citation, AI recommendations

## Install

```bash
npm install -g citekit-cli
```

One command to see where you stand:

```bash
citekit scan --name "Acme Corp" --domain acme.com
```

## What CiteKit Does

- **Scans** your domain for AI-readiness: `llms.txt`, robots.txt crawler access, schema markup, FAQ pages, comparison pages, pricing visibility
- **Probes** live AI engines (ChatGPT, Claude, Perplexity) to measure whether your brand is mentioned and cited when asked relevant questions
- **Benchmarks** your AI readiness against a curated market dataset — see where you rank
- **Diagnoses** the exact reasons you're losing AI citations to competitors
- **Generates** ranked fix candidates (schema, `llms.txt`, comparison pages, off-site proof) with predicted citation lift estimates
- **Watches** your domain continuously and alerts you when citation rate changes (`citekit watch`)
- **Integrates** with CI/CD — fail builds when citation rate drops below threshold

## Quick Start

```bash
# Check what's blocking AI crawlers
citekit doctor

# Full scan with competitor comparison
citekit scan \
  --name "Acme Corp" \
  --domain acme.com \
  --competitor "Competitor A" "Competitor B"

# Watch your domain (polls every 30 minutes, diffs results)
citekit watch --name "Acme Corp" --domain acme.com --interval 30

# Benchmark against 100+ real domains
citekit benchmark --preset founders --max-pages 3 --json

# Monitor share-of-voice across AI engines
citekit monitor --name "Acme Corp" --domain acme.com --prompt-count 8
```

Add your API keys for live provider probes:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export PERPLEXITY_API_KEY=pplx-...
export GOOGLE_GENERATIVE_AI_API_KEY=AIza...
```

Missing keys are reported as blockers. CiteKit never fakes provider results.

## CI/CD Integration

Add this to your GitHub Actions workflow to catch citation regressions on every deploy:

```yaml
- name: CiteKit citation check
  uses: Keesan12/CiteKit/.github/workflows/citekit-scan.yml@main
  with:
    domain: acme.com
    brand_name: "Acme Corp"
    min_citation_rate: "0.15"
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

See [`examples/github-action-ci-scan.yml`](examples/github-action-ci-scan.yml) for the full template.

## Commands

| Command | What it does |
|---|---|
| `citekit doctor` | Inspect provider and integration readiness with masked evidence |
| `citekit scan` | Full scan: probes + crawl signals + E-E-A-T diagnosis + ranked fixes |
| `citekit scan --agent` | Output machine-readable `agent_actions` JSON for AI agent pipelines |
| `citekit watch` | Continuous monitoring — polls on interval, diffs and alerts on changes (3 free runs) |
| `citekit voice` | Audit speakable schema, FAQPage, HowTo, and voice-assistant optimization signals |
| `citekit generate-llms-txt` | Generate `llms.txt` for AI crawler access (GPTBot, ClaudeBot, PerplexityBot) |
| `citekit monitor` | Measure share-of-voice visibility across prompt/provider panels |
| `citekit probe` | Run one prompt against configured providers |
| `citekit diagnose` | Explain why the brand is winning or losing citations |
| `citekit fix` | Generate safe fix drafts from diagnosis output |
| `citekit score` | Score citation/recommendation outcomes from probe output |
| `citekit benchmark` | Crawl preset domain sets and score AI-readiness foundation |

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
