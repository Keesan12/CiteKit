# CiteKit Context

## Purpose

CiteKit is the public OSS repository for the free AI visibility toolkit. It should be easy to install, inspect, run locally, and link from the CiteOps website.

## Boundary

- Public: `packages/citekit-core`, `packages/citekit-cli`, docs, examples, tests, and public boundary tooling.
- Private: CiteOps Hosted app/cloud, customer dashboards, billing, Sansa private runtime, TraceIntelligence private runtime, credentials, customer data, and internal handoff ZIPs.

## Verification

Run before pushing:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run boundary:public
```

## Upgrade Path

CiteKit should create value locally first, then point users toward CiteOps Cloud when they need scheduled monitoring, platform-aware PR/CMS drafts, proof cards, and autonomous verification.
