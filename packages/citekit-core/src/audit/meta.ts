import type { SignalResult } from "../types/index";

const META_DESC_MIN = 50;
const META_DESC_MAX = 160;
const H1_MAX_WORDS = 12;

export function auditMeta(html: string): SignalResult[] {
  return [
    checkMetaDescription(html),
    checkOpenGraph(html),
    checkH1(html),
  ];
}

function checkMetaDescription(html: string): SignalResult {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  if (!match) {
    return {
      signal: "meta_description",
      pass: false,
      weight: 2,
      detail: "No meta description found",
      fix: `Add <meta name="description" content="..."> with ${META_DESC_MIN}–${META_DESC_MAX} characters summarizing the page`,
    };
  }

  const content = match[0].match(/content=["']([^"']*?)["']/i)?.[1] ?? "";
  const len = content.trim().length;
  const inRange = len >= META_DESC_MIN && len <= META_DESC_MAX;

  return {
    signal: "meta_description",
    pass: inRange,
    weight: 2,
    detail: len > 0
      ? `Meta description is ${len} chars (target: ${META_DESC_MIN}–${META_DESC_MAX})`
      : "Meta description is empty",
    fix: inRange
      ? undefined
      : `Update meta description to ${META_DESC_MIN}–${META_DESC_MAX} characters — AI models read this when citing your page`,
  };
}

function checkOpenGraph(html: string): SignalResult {
  const hasOgTitle = /<meta[^>]+property=["']og:title["'][^>]*>/i.test(html);
  const hasOgDescription = /<meta[^>]+property=["']og:description["'][^>]*>/i.test(html);
  const pass = hasOgTitle && hasOgDescription;

  return {
    signal: "meta_og",
    pass,
    weight: 2,
    detail: pass
      ? "og:title and og:description Open Graph tags found"
      : !hasOgTitle
        ? "Missing og:title Open Graph tag"
        : "Missing og:description Open Graph tag",
    fix: pass
      ? undefined
      : "Add og:title and og:description meta tags — used by AI platforms when surfacing your brand in social/chat contexts",
  };
}

function checkH1(html: string): SignalResult {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) {
    return {
      signal: "meta_h1",
      pass: false,
      weight: 2,
      detail: "No <h1> found on page",
      fix: "Add a clear <h1> that states what the page is in under 12 words",
    };
  }

  const text = (match[1] ?? "").replace(/<[^>]+>/g, "").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const pass = text.length > 0 && wordCount <= H1_MAX_WORDS;

  return {
    signal: "meta_h1",
    pass,
    weight: 2,
    detail: text
      ? `H1: "${text.slice(0, 60)}" (${wordCount} words)`
      : "H1 is empty",
    fix: pass
      ? undefined
      : wordCount > H1_MAX_WORDS
        ? `Shorten H1 to under ${H1_MAX_WORDS} words for better AI extraction`
        : "Add descriptive text to H1",
  };
}
