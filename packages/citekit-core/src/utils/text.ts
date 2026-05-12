export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function extractUrlsFromText(input: string): string[] {
  const matches = input.match(/https?:\/\/[^\s)"'<>]+/gi) ?? [];
  return Array.from(new Set(matches.map((value) => value.replace(/[.,;!?]+$/, ""))));
}

export function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

