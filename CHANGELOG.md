# Changelog — CiteKit

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
