# Getting Started With CiteKit

## 1. Install

```bash
npm install -g citekit-cli
```

## 2. Check Readiness

```bash
citekit doctor
```

This checks whether provider and integration credentials are present. Missing credentials are blockers, not fake passes.

## 3. Run A Crawl Benchmark

```bash
citekit benchmark --preset founders --max-pages 3 --json
```

The benchmark checks machine-readable and answer-engine foundation signals such as `llms.txt`, `robots.txt`, sitemap, schema, canonical tags, pricing/docs/comparison pages, freshness, stats, and author signals.

## 4. Run A Brand Scan

```bash
citekit scan --name "Your Brand" --domain yourbrand.com --competitor "Competitor One" "Competitor Two"
```

Provider-backed scans require configured provider keys.

## 5. Upgrade When You Need The Loop

CiteKit is a local toolkit. CiteOps Cloud is the autonomous operator for scheduled monitoring, platform-aware PR/CMS drafts, proof cards, TraceIntelligence, and verification loops.
