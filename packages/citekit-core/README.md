# citekit-core

Public CiteKit core primitives for crawl, prompt generation, live provider probes, monitoring, diagnosis, fix generation, and benchmark scoring.

## Install

```bash
npm install citekit-core
```

## Included modules

- Crawl and normalize site content for prompt and benchmark workflows.
- Generate prompt sets for brand, competitor, and category visibility checks.
- Probe supported providers and score citation visibility outcomes.
- Monitor share-of-answer snapshots across provider panels.
- Diagnose missing proof, comparison, or trust signals and turn them into fix drafts.
- Benchmark preset domain universes with crawl-based AEO foundation scoring.

## Public boundary

This package is intended to stay OSS-safe. Use `npm run boundary:public` from the repo root to verify that `citekit-core` and `citekit-cli` do not import or declare private CiteOps surfaces.
