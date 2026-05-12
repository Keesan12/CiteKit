# CiteKit Repo Instructions

## Overview

- This repository is the public OSS home for CiteKit.
- Keep the repo clean, installable, and safe to link from the CiteOps website.
- CiteKit contains public core primitives and CLI workflows only.
- CiteOps Hosted is private and must not be copied into this repo.

## Commands

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run boundary:public`

## Safety

- Never commit real API keys, customer data, private specs, handoff ZIPs, or private hosted runtime files.
- Provider-backed flows must fail honestly when credentials are missing.
- Do not add fake provider outputs, fake benchmarks, or silent no-op production paths.

## Public Boundary

- `packages/citekit-core` and `packages/citekit-cli` must not import private CiteOps modules.
- Run `npm run boundary:public` before pushing.
- If a feature requires hosted scheduling, dashboards, billing, PR/CMS automation, Sansa, or TraceIntelligence, document it as a CiteOps Cloud upgrade path instead of adding private code here.
