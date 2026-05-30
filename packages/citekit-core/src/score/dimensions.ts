export interface DimensionWeight {
  signal: string;
  weight: number;
  dimension: "access" | "schema" | "content" | "infrastructure" | "meta" | "probe";
  description: string;
}

export const DIMENSION_WEIGHTS: DimensionWeight[] = [
  // AI access signals (24 pts)
  { signal: "robots_ai_access", weight: 10, dimension: "access", description: "AI crawler permission in robots.txt" },
  { signal: "llms_txt", weight: 14, dimension: "access", description: "llms.txt AI-readable content manifest" },

  // Schema signals (29 pts)
  { signal: "schema_organization", weight: 8, dimension: "schema", description: "Organization or LocalBusiness schema" },
  { signal: "schema_faq", weight: 9, dimension: "schema", description: "FAQPage schema with ≥3 entries" },
  { signal: "schema_author", weight: 4, dimension: "schema", description: "Person / author markup" },
  { signal: "schema_freshness", weight: 3, dimension: "schema", description: "Article with datePublished/dateModified" },
  { signal: "schema_rating", weight: 2, dimension: "schema", description: "AggregateRating schema" },
  { signal: "schema_entity_link", weight: 3, dimension: "schema", description: "Wikidata/Wikipedia sameAs link" },

  // Content signals (9 pts)
  { signal: "content_word_count", weight: 3, dimension: "content", description: "≥300 words on page" },
  { signal: "content_headings", weight: 2, dimension: "content", description: "H2/H3 subheadings present" },
  { signal: "content_faq", weight: 4, dimension: "content", description: "FAQ-style Q&A content" },

  // Infrastructure signals (7 pts)
  { signal: "infra_https", weight: 2, dimension: "infrastructure", description: "HTTPS enabled" },
  { signal: "infra_sitemap", weight: 3, dimension: "infrastructure", description: "sitemap.xml present" },
  { signal: "infra_canonical", weight: 2, dimension: "infrastructure", description: "Canonical link tag" },

  // Meta signals (6 pts)
  { signal: "meta_description", weight: 2, dimension: "meta", description: "Meta description (50–160 chars)" },
  { signal: "meta_og", weight: 2, dimension: "meta", description: "Open Graph og:title + og:description" },
  { signal: "meta_h1", weight: 2, dimension: "meta", description: "H1 heading ≤12 words" },

  // SPA gap (5 pts)
  { signal: "spa_gap", weight: 5, dimension: "content", description: "Server-rendered content detected" },

  // Citation probe (20 pts — opt-in)
  { signal: "citation_probe", weight: 20, dimension: "probe", description: "Domain cited by AI in test query" },
];

export const SIGNAL_WEIGHTS: Record<string, number> = Object.fromEntries(
  DIMENSION_WEIGHTS.map((d) => [d.signal, d.weight]),
);

export const MAX_SCORE_WITHOUT_PROBE = DIMENSION_WEIGHTS
  .filter((d) => d.signal !== "citation_probe")
  .reduce((sum, d) => sum + d.weight, 0);

export const MAX_SCORE_WITH_PROBE = MAX_SCORE_WITHOUT_PROBE + 20;
