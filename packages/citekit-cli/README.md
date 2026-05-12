# citekit-cli

Public CiteKit command-line tools for scanning AI citation visibility, checking integration readiness, diagnosing answer-engine gaps, generating fix drafts, and benchmarking crawl-based AEO foundations.

## Install

```bash
npm install citekit-cli
```

## Quick start

```bash
citekit doctor
citekit scan --name "CiteOps" --domain citeops.ai --competitor "Profound" "Peec AI"
citekit monitor --name "CiteOps" --domain citeops.ai --prompt-count 8
citekit benchmark --preset founders --max-pages 3 --output docs/benchmarks/founders.json
```

Provider-backed commands (`scan`, `monitor`, `probe`, `diagnose`, `fix`, `score`) require at least one configured provider API key in the environment.

## Commands

- `citekit doctor`: inspect provider and integration readiness without printing raw secrets.
- `citekit scan`: run prompt generation, provider probes, diagnosis, and fix recommendation in one pass.
- `citekit monitor`: measure share-of-answer and routing signals across repeated prompt/provider panels.
- `citekit probe`: run a single prompt against configured providers.
- `citekit diagnose`: explain the likely reasons the brand is winning or losing.
- `citekit fix`: generate draft fixes from live diagnosis output.
- `citekit score`: compute recommendation status and citation-share signals from a live probe.
- `citekit benchmark`: crawl preset domain sets and score AEO foundation readiness.

Run `citekit <command> --help` for command-specific examples.
