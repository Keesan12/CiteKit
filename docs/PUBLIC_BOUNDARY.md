# Public Boundary

CiteKit is the OSS hook. It must remain safe to publish publicly.

## Allowed

- `packages/citekit-core`
- `packages/citekit-cli`
- Public docs and examples
- Public-safe tests and fixture credentials
- Boundary tooling

## Not Allowed

- CiteOps Hosted app/cloud source
- Private MartinLoop/Sansa/TraceIntelligence runtime code
- Billing, dashboards, customer persistence, or private deployment configs
- Provider credentials or `.env` files
- Customer content, raw AI responses from customer workspaces, or internal handoff ZIPs

## Required Check

```bash
npm run boundary:public
```
