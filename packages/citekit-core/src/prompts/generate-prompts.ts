import { BrandSeedSchema, PromptDraftSchema, type BrandSeed, type PromptDraft } from "../schema/core";
import { DEFAULT_PROMPT_TEMPLATES } from "./templates";

const INTERPOLATION_DEFAULTS = {
  persona: "B2B buyers",
  use_case: "mid-market teams",
  size: "25",
  industry: "SaaS",
  budget: "$200/month",
  tool: "HubSpot",
};

function interpolate(template: string, brand: BrandSeed, competitorName: string): string {
  const replacements = {
    brand: brand.name,
    competitor: competitorName,
    category: brand.category ?? "software",
    persona: brand.targetPersona ?? INTERPOLATION_DEFAULTS.persona,
    use_case: brand.description ?? INTERPOLATION_DEFAULTS.use_case,
    size: INTERPOLATION_DEFAULTS.size,
    industry: brand.category ?? INTERPOLATION_DEFAULTS.industry,
    budget: INTERPOLATION_DEFAULTS.budget,
    tool: "Slack",
  } as const;

  return template.replace(/\{(\w+)\}/g, (_, key: keyof typeof replacements) => replacements[key] ?? "");
}

export function generatePrompts(seedInput: BrandSeed, limit = 25): PromptDraft[] {
  const seed = BrandSeedSchema.parse(seedInput);
  const competitors = seed.competitors.length > 0 ? seed.competitors : [{ name: "category leader" }];
  const generated: PromptDraft[] = [];

  for (const competitor of competitors) {
    for (const template of DEFAULT_PROMPT_TEMPLATES) {
      generated.push(
        PromptDraftSchema.parse({
          prompt_text: interpolate(template.template, seed, competitor.name),
          intent_type: template.intent,
          buyer_stage: template.buyerStage,
          priority: template.priority,
        }),
      );
      if (generated.length >= limit) {
        return generated;
      }
    }
  }

  while (generated.length < limit) {
    const template = DEFAULT_PROMPT_TEMPLATES[generated.length % DEFAULT_PROMPT_TEMPLATES.length];
    if (!template) {
      throw new Error("No prompt templates are configured.");
    }
    generated.push(
      PromptDraftSchema.parse({
        prompt_text: interpolate(template.template, seed, seed.competitors[0]?.name ?? "category leader"),
        intent_type: template.intent,
        buyer_stage: template.buyerStage,
        priority: template.priority,
      }),
    );
  }

  return generated.slice(0, limit);
}
