# CLI Quickstart

```bash
citekit doctor
citekit doctor --json
citekit benchmark --preset founders --max-pages 3 --json
citekit monitor --name "CiteOps" --domain citeops.ai --prompt-count 8
citekit scan --name "CiteOps" --domain citeops.ai --competitor "Profound" "Peec AI"
```

For live provider probes, set one or more provider keys:

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
PERPLEXITY_API_KEY=
OPENROUTER_API_KEY=
```
