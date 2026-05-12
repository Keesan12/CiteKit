import type { PromptIntent } from "../db/types";

export interface PromptTemplate {
  intent: PromptIntent;
  template: string;
  buyerStage: string | null;
  priority: number;
}

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  { intent: "best_tool", template: "What is the best {category} for {persona}?", buyerStage: "awareness", priority: 9 },
  { intent: "best_tool", template: "Top {category} tools for startups in 2026", buyerStage: "awareness", priority: 8 },
  { intent: "best_tool", template: "What do {persona} use for {category}?", buyerStage: "consideration", priority: 7 },
  { intent: "comparison", template: "{brand} vs {competitor} — which is better for {persona}?", buyerStage: "decision", priority: 10 },
  { intent: "comparison", template: "What is the difference between {brand} and {competitor}?", buyerStage: "decision", priority: 9 },
  { intent: "comparison", template: "Should I use {brand} or {competitor} for {use_case}?", buyerStage: "decision", priority: 9 },
  { intent: "alternative", template: "Alternatives to {competitor} for {use_case}", buyerStage: "consideration", priority: 8 },
  { intent: "alternative", template: "What are the best {competitor} alternatives?", buyerStage: "consideration", priority: 8 },
  { intent: "alternative", template: "Cheapest alternative to {competitor}", buyerStage: "consideration", priority: 6 },
  { intent: "use_case", template: "Recommend a {category} for a team of {size}", buyerStage: "consideration", priority: 7 },
  { intent: "use_case", template: "What {category} do YC companies use?", buyerStage: "awareness", priority: 6 },
  { intent: "use_case", template: "Best {category} for {industry}", buyerStage: "consideration", priority: 7 },
  { intent: "pricing", template: "How much does {brand} cost?", buyerStage: "decision", priority: 10 },
  { intent: "pricing", template: "Is {brand} worth it for {persona}?", buyerStage: "decision", priority: 8 },
  { intent: "pricing", template: "Best {category} under {budget}", buyerStage: "consideration", priority: 6 },
  { intent: "integration", template: "Does {brand} integrate with {tool}?", buyerStage: "decision", priority: 7 },
  { intent: "integration", template: "What {category} works best with {tool}?", buyerStage: "consideration", priority: 6 },
  { intent: "compliance", template: "Is {brand} SOC2 compliant?", buyerStage: "decision", priority: 9 },
  { intent: "compliance", template: "Which {category} is best for enterprise security?", buyerStage: "consideration", priority: 7 },
];

