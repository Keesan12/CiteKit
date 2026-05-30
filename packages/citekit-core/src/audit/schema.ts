import type { SignalResult } from "../types/index";

type SchemaBlock = Record<string, unknown>;

export function parseSchemaBlocks(html: string): SchemaBlock[] {
  const blocks: SchemaBlock[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? "");
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") {
          blocks.push(item as SchemaBlock);
        }
      }
    } catch {
      // skip malformed blocks
    }
  }

  return blocks;
}

function getTypes(block: SchemaBlock): string[] {
  const t = block["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t.map(String) : [String(t)];
}

export function auditSchema(html: string): SignalResult[] {
  const blocks = parseSchemaBlocks(html);

  const orgBlocks = blocks.filter((b) =>
    getTypes(b).some((t) => t === "Organization" || t === "LocalBusiness"),
  );

  const faqBlocks = blocks.filter((b) => getTypes(b).includes("FAQPage"));
  const faqEntries = faqBlocks.flatMap((b) => {
    const e = b["mainEntity"];
    return Array.isArray(e) ? e : [];
  });

  const hasAuthor = blocks.some(
    (b) => getTypes(b).includes("Person") || Boolean(b["author"]),
  );

  const articleBlocks = blocks.filter((b) =>
    getTypes(b).some((t) => t === "Article" || t === "BlogPosting" || t === "NewsArticle"),
  );
  const hasFreshness = articleBlocks.some(
    (b) => Boolean(b["datePublished"]) || Boolean(b["dateModified"]),
  );

  const hasRating = blocks.some(
    (b) => Boolean(b["aggregateRating"]) || getTypes(b).includes("AggregateRating"),
  );

  const hasSameAs = orgBlocks.some((b) => {
    const raw = b["sameAs"];
    const links = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return links.some(
      (l) =>
        typeof l === "string" &&
        (l.includes("wikidata.org") || l.includes("wikipedia.org")),
    );
  });

  return [
    {
      signal: "schema_organization",
      pass: orgBlocks.length > 0,
      weight: 8,
      detail:
        orgBlocks.length > 0
          ? "Organization or LocalBusiness schema detected"
          : "No Organization schema found",
      fix:
        orgBlocks.length > 0
          ? undefined
          : 'Add Organization JSON-LD: { "@type": "Organization", "name": "...", "url": "...", "logo": "..." }',
    },
    {
      signal: "schema_faq",
      pass: faqEntries.length >= 3,
      weight: 9,
      detail:
        faqBlocks.length > 0
          ? `FAQPage found with ${faqEntries.length} entr${faqEntries.length === 1 ? "y" : "ies"}`
          : "No FAQPage schema detected",
      fix:
        faqEntries.length >= 3
          ? undefined
          : "Add FAQPage JSON-LD with ≥3 question/answer pairs covering your core use cases",
    },
    {
      signal: "schema_author",
      pass: hasAuthor,
      weight: 4,
      detail: hasAuthor ? "Person or author markup detected" : "No author markup found",
      fix: hasAuthor
        ? undefined
        : "Add Person schema with name, jobTitle, and knowsAbout on article/about pages",
    },
    {
      signal: "schema_freshness",
      pass: hasFreshness,
      weight: 3,
      detail:
        articleBlocks.length > 0
          ? hasFreshness
            ? "Article schema has datePublished/dateModified"
            : "Article schema missing date fields"
          : "No Article schema found",
      fix: hasFreshness
        ? undefined
        : "Add datePublished and dateModified to all Article schema — fresh content gets cited more",
    },
    {
      signal: "schema_rating",
      pass: hasRating,
      weight: 2,
      detail: hasRating ? "AggregateRating detected" : "No AggregateRating schema found",
      fix: hasRating
        ? undefined
        : "Add AggregateRating to product or service pages — social proof is a strong AI citation signal",
    },
    {
      signal: "schema_entity_link",
      pass: hasSameAs,
      weight: 3,
      detail: hasSameAs
        ? "Wikidata or Wikipedia sameAs link found in Organization schema"
        : "No Wikidata/Wikipedia sameAs link found",
      fix: hasSameAs
        ? undefined
        : 'Add sameAs: ["https://www.wikidata.org/wiki/Q..."] to Organization — disambiguates your brand for AI models',
    },
  ];
}
