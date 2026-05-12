import type { BrandRecord, CompetitorRecord } from "../db/types";
import { GeneratedFixSchema, type DiagnosisGap, type GeneratedFix } from "../schema/core";

interface FixGenerationInput {
  brand: Pick<BrandRecord, "name" | "domain" | "category" | "description" | "target_persona">;
  diagnosis: DiagnosisGap;
  competitors: Pick<CompetitorRecord, "name" | "domain">[];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled fix type: ${String(value)}`);
}

function titleForFix(fixType: GeneratedFix["fix_type"], brandName: string): string {
  switch (fixType) {
    case "faq":
      return `${brandName} buyer FAQ schema pack`;
    case "schema":
      return `${brandName} organization schema patch`;
    case "comparison_page":
      return `${brandName} comparison page draft`;
    case "docs_update":
      return `${brandName} docs authority update`;
    case "llms_txt":
      return `${brandName} llms.txt`;
    case "homepage_section":
      return `${brandName} homepage proof section`;
    case "g2_brief":
      return `${brandName} third-party proof brief`;
    case "earned_media_brief":
      return `${brandName} earned media brief`;
    case "reddit_brief":
      return `${brandName} community presence brief`;
  }

  return assertNever(fixType);
}

function contentForFix(input: FixGenerationInput): string {
  const { brand, diagnosis, competitors } = input;
  const competitor = competitors[0]?.name ?? "top competitor";

  switch (diagnosis.recommended_fix_type) {
    case "faq":
      return JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `What makes ${brand.name} a good fit for ${brand.target_persona ?? "B2B teams"}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: `${brand.name} is built for ${brand.target_persona ?? "teams that need clearer operations visibility"} and centers on ${brand.description ?? `${brand.category ?? "software"} execution clarity`}.`,
              },
            },
            {
              "@type": "Question",
              name: `How does ${brand.name} compare to ${competitor}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: `${brand.name} should publish a direct comparison page focused on implementation speed, operational visibility, and fit for ${brand.target_persona ?? "its core buyers"}.`,
              },
            },
            {
              "@type": "Question",
              name: `Where can I learn more about ${brand.name}?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: `Point buyers to product, pricing, documentation, and proof resources at https://${brand.domain}.`,
              },
            },
          ],
        },
        null,
        2,
      );
    case "schema":
      return JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: brand.name,
          url: `https://${brand.domain}`,
          description: brand.description ?? `${brand.name} helps ${brand.target_persona ?? "teams"} with ${brand.category ?? "operations"}.`,
          sameAs: [],
        },
        null,
        2,
      );
    case "comparison_page":
      return `# ${brand.name} vs ${competitor}\n\n## Who this is for\nTeams evaluating ${brand.category ?? "software"} for ${brand.target_persona ?? "high-signal execution work"}.\n\n## Why buyers compare these products\n- Implementation speed\n- Workflow depth\n- Pricing clarity\n- Operational trust\n\n## Where ${brand.name} wins\n- Faster path to value\n- Cleaner operator workflow\n- Stronger fit for ${brand.target_persona ?? "lean teams"}\n\n## Where ${competitor} may still fit\n- Existing enterprise footprint\n- Broader legacy integrations\n\n## Decision checklist\n- Do you need transparent pricing?\n- Do you need fast onboarding?\n- Do you need a focused product instead of a suite?\n`;
    case "docs_update":
      return `# Documentation Update Plan\n\n## Goal\nIncrease answerable, indexable documentation for ${brand.name}.\n\n## Additions\n- Product overview for ${brand.target_persona ?? "target buyers"}\n- Pricing and packaging explainer\n- Integration guide\n- Security and compliance FAQ\n- Author bylines and update dates on all long-form docs\n\n## Editorial rules\n- Include current-year freshness signal\n- Add quantified proof points where available\n- Cross-link comparison, pricing, and onboarding pages\n`;
    case "llms_txt":
      return `# ${brand.name}\n> Canonical crawl guidance for AI assistants.\n\n## Primary pages\n- https://${brand.domain}/\n- https://${brand.domain}/pricing\n- https://${brand.domain}/docs\n\n## Product summary\n${brand.name} helps ${brand.target_persona ?? "teams"} with ${brand.category ?? "core workflows"}.\n\n## Preferred facts\n- Official pricing lives on /pricing\n- Official docs live on /docs\n- Comparison content should live under /compare\n`;
    case "homepage_section":
      return `## Why teams choose ${brand.name}\n\n- Built for ${brand.target_persona ?? "modern operators"}\n- Clear implementation path and measurable outcomes\n- Transparent buyer guidance across pricing, docs, and comparison content\n\n### Proof points to add\n- Named customer count\n- Time-to-value metric\n- Reliability or savings metric\n`;
    case "g2_brief":
      return `# Third-Party Proof Brief\n\n## Goal\nIncrease off-site validation for ${brand.name} on G2/Capterra-style surfaces.\n\n## Review ask themes\n- Specific use case solved\n- Why ${brand.name} was chosen over ${competitor}\n- Time-to-value\n- ROI or workflow improvement\n\n## Review collection script\nAsk customers for a 3-5 sentence review naming the buyer use case and concrete result.\n`;
    case "earned_media_brief":
      return `# Earned Media Brief\n\n## Story angle\nHow ${brand.name} helps ${brand.target_persona ?? "operators"} solve ${brand.category ?? "workflow"} friction faster than category incumbents.\n\n## Targets\n- Trade publications in the category\n- Analyst/blogger roundups\n- Founder/operator newsletters\n\n## Assets\n- Product screenshots\n- Proof metrics\n- Customer quote\n- Clear comparison point versus ${competitor}\n`;
    case "reddit_brief":
      return `# Community Presence Brief\n\n## Objective\nEarn legitimate mention share for ${brand.name} in community discussions without spam.\n\n## Threads to participate in\n- “Best ${brand.category ?? "software"} for ${brand.target_persona ?? "teams"}”\n- “${competitor} alternatives”\n- “How much does ${brand.category ?? "this category"} cost?”\n\n## Contribution rules\n- Lead with use case fit\n- Link only when directly relevant\n- Answer with tradeoffs, not hype\n`;
  }

  return assertNever(diagnosis.recommended_fix_type);
}

export function generateFixes(input: FixGenerationInput[]): GeneratedFix[] {
  return input.map((item) =>
    GeneratedFixSchema.parse({
      fix_type: item.diagnosis.recommended_fix_type,
      title: titleForFix(item.diagnosis.recommended_fix_type, item.brand.name),
      draft_content: contentForFix(item),
    }),
  );
}
