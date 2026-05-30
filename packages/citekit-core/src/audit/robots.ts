import type { SignalResult } from "../types/index";
import { fetchWithTimeout, type FetchResult } from "../utils/fetch";

const AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "anthropic-ai", "cohere-ai"];

function isAgentBlocked(body: string, userAgent: string): boolean {
  const lines = body.split("\n").map((l) => l.trim());
  let inScope = false;

  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.replace(/^user-agent:\s*/i, "").trim();
      inScope = agent === "*" || agent.toLowerCase() === userAgent.toLowerCase();
    }

    if (inScope && /^disallow:/i.test(line)) {
      const path = line.replace(/^disallow:\s*/i, "").trim();
      if (path === "/" || path === "") {
        return true;
      }
    }
  }

  return false;
}

function hasExplicitAiEntry(body: string): boolean {
  const lower = body.toLowerCase();
  return AI_BOTS.some((bot) => lower.includes(bot.toLowerCase()));
}

export async function auditRobots(
  domain: string,
  opts: { timeout?: number; userAgent?: string } = {},
): Promise<SignalResult> {
  let res: FetchResult;

  try {
    res = await fetchWithTimeout(
      `https://${domain}/robots.txt`,
      opts.timeout ?? 10_000,
      opts.userAgent,
    );
  } catch {
    return {
      signal: "robots_ai_access",
      pass: false,
      weight: 10,
      detail: "robots.txt fetch failed — assuming restrictive default",
      fix: "Publish /robots.txt with explicit User-agent entries for GPTBot and ClaudeBot",
    };
  }

  if (!res.ok || res.status === 404) {
    return {
      signal: "robots_ai_access",
      pass: false,
      weight: 10,
      detail: "No robots.txt found — AI crawlers lack explicit permission signal",
      fix: "Create /robots.txt with User-agent: GPTBot / Allow: / entries for each AI crawler",
    };
  }

  const body = res.body;

  for (const bot of AI_BOTS) {
    if (isAgentBlocked(body, bot)) {
      return {
        signal: "robots_ai_access",
        pass: false,
        weight: 10,
        detail: `${bot} is explicitly disallowed in robots.txt`,
        fix: `Remove or update the Disallow rule for ${bot} to allow AI indexing`,
      };
    }
  }

  const explicit = hasExplicitAiEntry(body);

  return {
    signal: "robots_ai_access",
    pass: explicit,
    weight: 10,
    detail: explicit
      ? "robots.txt has explicit AI bot entries with no blocks"
      : "robots.txt exists but has no explicit AI bot entries — add User-agent sections for GPTBot, ClaudeBot, PerplexityBot",
    fix: explicit
      ? undefined
      : "Add User-agent: GPTBot / Allow: / (and similar for ClaudeBot, PerplexityBot, Google-Extended) to /robots.txt",
  };
}
