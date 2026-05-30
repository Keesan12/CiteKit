import type { SignalResult } from "../types/index";

const WORD_COUNT_THRESHOLD = 300;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 1).length;
}

function hasSubheadings(html: string): boolean {
  return /<h[2-3][^>]*>[\s\S]*?<\/h[2-3]>/i.test(html);
}

function hasFaqContent(html: string): boolean {
  const text = stripTags(html).toLowerCase();
  const questionPatterns = [
    /\bwhat is\b/,
    /\bhow (do|does|to|can)\b/,
    /\bwhy (do|does|is|are|should)\b/,
    /\bfrequently asked\b/,
    /\bfaq\b/,
    /\bq:\s/,
    /\?[\s\S]{10,200}\./,
  ];

  const matchCount = questionPatterns.filter((p) => p.test(text)).length;
  return matchCount >= 2;
}

export function auditContent(html: string): SignalResult[] {
  const text = stripTags(html);
  const wordCount = countWords(text);
  const hasHeadings = hasSubheadings(html);
  const hasFaq = hasFaqContent(html);

  return [
    {
      signal: "content_word_count",
      pass: wordCount >= WORD_COUNT_THRESHOLD,
      weight: 3,
      detail: `${wordCount} words on page (threshold: ${WORD_COUNT_THRESHOLD})`,
      fix:
        wordCount >= WORD_COUNT_THRESHOLD
          ? undefined
          : `Expand page content to at least ${WORD_COUNT_THRESHOLD} words — thin pages are rarely cited by AI models`,
    },
    {
      signal: "content_headings",
      pass: hasHeadings,
      weight: 2,
      detail: hasHeadings ? "H2/H3 subheadings detected" : "No H2/H3 subheadings found",
      fix: hasHeadings
        ? undefined
        : "Add H2/H3 section headings — AI models parse headings to structure their answers",
    },
    {
      signal: "content_faq",
      pass: hasFaq,
      weight: 4,
      detail: hasFaq
        ? "FAQ-style Q&A content detected"
        : "No FAQ-style content detected on page",
      fix: hasFaq
        ? undefined
        : "Add a FAQ section with questions your audience asks — AI assistants pull direct answers from Q&A content",
    },
  ];
}
