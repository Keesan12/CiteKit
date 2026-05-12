import type { BenchmarkTarget } from "./foundation-benchmark";

export const FOUNDER_SITES: readonly BenchmarkTarget[] = [
  { name: "MartinLoop", domain: "martinloop.com", segment: "founder", founderOwned: true },
  { name: "CFRI", domain: "cfri.io", segment: "founder", founderOwned: true },
  { name: "Torram", domain: "torram.xyz", segment: "founder", founderOwned: true },
  { name: "Siglieri", domain: "siglieri.com", segment: "founder", founderOwned: true },
  { name: "FurnaceFirst", domain: "furnacefirst.ca", segment: "founder", founderOwned: true },
  { name: "Kaizan Labs", domain: "kaizanlabs.com", segment: "founder", founderOwned: true },
] as const;

export const MARKET_SCOREBOARD_TARGETS: readonly BenchmarkTarget[] = [
  ...FOUNDER_SITES,
  { name: "OpenAI", domain: "openai.com", segment: "ai-platform" },
  { name: "Anthropic", domain: "anthropic.com", segment: "ai-platform" },
  { name: "Perplexity", domain: "perplexity.ai", segment: "ai-platform" },
  { name: "Google AI", domain: "ai.google", segment: "ai-platform" },
  { name: "Cloudflare", domain: "cloudflare.com", segment: "infra" },
  { name: "Vercel", domain: "vercel.com", segment: "infra" },
  { name: "Stripe", domain: "stripe.com", segment: "payments" },
  { name: "HubSpot", domain: "hubspot.com", segment: "growth" },
  { name: "Semrush", domain: "semrush.com", segment: "seo" },
  { name: "Ahrefs", domain: "ahrefs.com", segment: "seo" },
  { name: "Zapier", domain: "zapier.com", segment: "automation" },
  { name: "Notion", domain: "notion.so", segment: "productivity" },
  { name: "Linear", domain: "linear.app", segment: "productivity" },
  { name: "Airtable", domain: "airtable.com", segment: "productivity" },
  { name: "Webflow", domain: "webflow.com", segment: "web" },
  { name: "Shopify", domain: "shopify.com", segment: "commerce" },
  { name: "Supabase", domain: "supabase.com", segment: "developer" },
  { name: "Replit", domain: "replit.com", segment: "developer" },
  { name: "Cursor", domain: "cursor.com", segment: "developer" },
  { name: "Brex", domain: "brex.com", segment: "fintech" },
  { name: "Ramp", domain: "ramp.com", segment: "fintech" },
  { name: "Intercom", domain: "intercom.com", segment: "support" },
  { name: "G2", domain: "g2.com", segment: "reviews" },
  { name: "Capterra", domain: "capterra.com", segment: "reviews" },
  { name: "Monday.com", domain: "monday.com", segment: "productivity" },
  { name: "ClickUp", domain: "clickup.com", segment: "productivity" },
  { name: "Salesforce", domain: "salesforce.com", segment: "enterprise" },
  { name: "Oracle", domain: "oracle.com", segment: "enterprise" },
  { name: "Atlassian", domain: "atlassian.com", segment: "productivity" },
] as const;

export type ScoreboardPreset = "founders" | "market";

export function getScoreboardPreset(preset: ScoreboardPreset): readonly BenchmarkTarget[] {
  return preset === "founders" ? FOUNDER_SITES : MARKET_SCOREBOARD_TARGETS;
}
