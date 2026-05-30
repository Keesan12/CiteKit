import type { FixEntry, SignalResult } from "../types/index";

type CatalogueEntry = Omit<FixEntry, "signal">;

const CATALOGUE: Record<string, CatalogueEntry> = {
  robots_ai_access: { title: "Add explicit AI bot entries to robots.txt", effort: "low", predicted_lift: 10 },
  llms_txt: {
    title: "Create llms.txt AI content manifest",
    effort: "low",
    predicted_lift: 14,
    citekit_command: "citekit generate-llms-txt --name <brand> --domain <domain>",
  },
  schema_organization: { title: "Add Organization JSON-LD schema", effort: "low", predicted_lift: 8 },
  schema_faq: { title: "Add FAQPage schema with ≥3 entries", effort: "medium", predicted_lift: 9 },
  schema_author: { title: "Add Person / author schema markup", effort: "low", predicted_lift: 4 },
  schema_freshness: { title: "Add datePublished and dateModified to Article schema", effort: "low", predicted_lift: 3 },
  schema_rating: { title: "Add AggregateRating schema to product pages", effort: "medium", predicted_lift: 2 },
  schema_entity_link: {
    title: "Link Organization schema to Wikidata / Wikipedia via sameAs",
    effort: "low",
    predicted_lift: 3,
  },
  content_word_count: { title: "Expand page content to ≥300 words", effort: "medium", predicted_lift: 3 },
  content_headings: { title: "Add H2/H3 section headings to page content", effort: "low", predicted_lift: 2 },
  content_faq: { title: "Add FAQ-style Q&A section to page", effort: "medium", predicted_lift: 4 },
  infra_https: { title: "Enable HTTPS and redirect HTTP to HTTPS", effort: "medium", predicted_lift: 2 },
  infra_sitemap: { title: "Create and publish /sitemap.xml", effort: "low", predicted_lift: 3 },
  infra_canonical: { title: "Add canonical link tag to <head>", effort: "low", predicted_lift: 2 },
  meta_description: { title: "Write meta description (50–160 chars)", effort: "low", predicted_lift: 2 },
  meta_og: { title: "Add og:title and og:description Open Graph tags", effort: "low", predicted_lift: 2 },
  meta_h1: { title: "Add clear H1 heading (≤12 words)", effort: "low", predicted_lift: 2 },
  spa_gap: {
    title: "Enable server-side rendering to expose content to AI crawlers",
    effort: "high",
    predicted_lift: 5,
  },
  citation_probe: {
    title: "Improve structural signals to increase AI citation rate",
    effort: "high",
    predicted_lift: 20,
    citekit_command: "citekit scan --name <brand> --domain <domain>",
  },
};

export function getFixesForSignals(signals: SignalResult[]): FixEntry[] {
  return signals
    .filter((s) => !s.pass)
    .map((s): FixEntry | null => {
      const entry = CATALOGUE[s.signal];
      if (!entry) return null;
      return { signal: s.signal, ...entry };
    })
    .filter((f): f is FixEntry => f !== null)
    .sort((a, b) => b.predicted_lift - a.predicted_lift);
}

export { CATALOGUE as FIX_CATALOGUE };
