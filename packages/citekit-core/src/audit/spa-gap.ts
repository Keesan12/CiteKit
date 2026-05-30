import type { SignalResult } from "../types/index";

const BODY_TEXT_THRESHOLD = 500;

const SPA_ROOT_PATTERNS = [
  /\bid=["']root["']/i,
  /\bid=["']app["']/i,
  /\bid=["']__next["']/i,
  /\bid=["']__nuxt["']/i,
  /ng-version=/i,
  /data-reactroot/i,
];

function extractBodyText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] ?? html;

  return bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSpaMarkers(html: string): boolean {
  return SPA_ROOT_PATTERNS.some((p) => p.test(html));
}

export function auditSpaGap(html: string): SignalResult {
  const bodyText = extractBodyText(html);
  const charCount = bodyText.length;
  const isSparse = charCount < BODY_TEXT_THRESHOLD;
  const spaMarkers = hasSpaMarkers(html);

  const isSpaWithoutSSR = isSparse && spaMarkers;

  if (isSpaWithoutSSR) {
    return {
      signal: "spa_gap",
      pass: false,
      weight: 5,
      detail: `SPA framework detected with only ${charCount} chars of server-rendered text — AI crawlers cannot read JS-rendered content`,
      fix: "Enable server-side rendering (SSR) or static generation so AI crawlers can read your content without executing JavaScript",
    };
  }

  if (isSparse) {
    return {
      signal: "spa_gap",
      pass: false,
      weight: 5,
      detail: `Only ${charCount} chars of visible text detected — page may be JS-rendered or unusually sparse`,
      fix: `Ensure at least ${BODY_TEXT_THRESHOLD} chars of text are in server-rendered HTML so AI crawlers can index your content`,
    };
  }

  return {
    signal: "spa_gap",
    pass: true,
    weight: 5,
    detail: `${charCount} chars of server-rendered content detected`,
  };
}
