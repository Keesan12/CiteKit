# Changelog — CiteKit

## v0.1.2 — 2026-05-16

### Added
- **`citekit voice` command** (`packages/citekit-cli/src/commands/voice.ts`)
  - Audits speakable schema, FAQPage, HowTo, voice-optimized title/H1, Organization description length
  - `speakable` markup is the least-known GEO signal — tells Google Assistant, Alexa, and AI voice interfaces which sections to read aloud
  - Per-check predicted citation lift estimates + specific fix instructions
- **`citekit generate-llms-txt` command** (`packages/citekit-cli/src/commands/generate.ts`)
  - Crawls domain and generates a production-ready `llms.txt` and `llms-full.txt` scaffold
  - `llms.txt` enables GPTBot, ClaudeBot, PerplexityBot, and Google-Extended to index your content
  - `--output <path>` writes directly to file; `--json` for pipeline use
- **`citekit scan --agent` flag**
  - Outputs machine-readable `agent_actions` JSON with priority, action type, predicted lift, and `citekit_command` for each fix
  - Schema: `citekit/agent/v1` — designed for AI agent pipelines, n8n, Zapier, CI/CD
- **E-E-A-T & Entity Authority Signals in scan report**
  - 7 deterministic checks: Organization schema, Wikidata/Wikipedia sameAs, author markup (Person schema), AggregateRating, content freshness (datePublished/dateModified), contactPoint, knowsAbout
  - These are the signals AI models use to decide whether to *trust* a brand enough to cite it
- **CiteOps Cloud upgrade gate**
  - Every scan output ends with a conversion prompt showing gap count + `→ citeops.ai/upgrade`
  - `citekit watch` exits after 3 free runs with a hard paywall message

---

## v0.1.1 — 2026-05-15

### Added
- **`citekit watch` command** (`packages/citekit-cli/src/commands/watch.ts`)
  - Polls `citekit monitor` on a configurable interval (default 30 min)
  - Diffs results against previous run and prints only what changed
  - Alerts with colored output when citation rate drops > 10%
  - `--interval <minutes>` flag to control poll cadence
  - Free, local taste of the autonomous monitoring loop before upgrading to CiteOps Cloud
- **`citekit scan --cloud` flag** (`packages/citekit-cli/src/commands/scan.ts`)
  - When `CITEOPS_API_KEY` is set, POSTs scan result to CiteOps Cloud for persistence and dashboard display
  - OSS → Pro upgrade bridge: one flag, same local scan, adds cloud history
- **GitHub Actions CI template** (`examples/github-action-ci-scan.yml`)
  - Drop-in workflow that runs `citekit scan` on every deploy
  - Fails the build if citation rate drops below configurable threshold
  - Posts scan summary as PR comment via GitHub Actions output

### Improved
- README: added npm badges, keyword section for discoverability, CI/CD integration section, full command reference table

---

## v0.1.0 — 2026-05-14

### Added
- Initial release with 8 CLI commands: `scan`, `monitor`, `probe`, `diagnose`, `fix`, `score`, `benchmark`, `doctor`
- `citekit-core` TypeScript primitives: crawl, probe, monitor, diagnose, fix, score, proof, benchmark workflows
- `citekit-cli` public CLI wrapper
- 53 tests passing, OSS boundary check
- Published to GitHub: [Keesan12/CiteKit](https://github.com/Keesan12/CiteKit)
