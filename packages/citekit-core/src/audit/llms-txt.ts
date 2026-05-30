import type { SignalResult } from "../types/index";
import { fetchWithTimeout } from "../utils/fetch";

export async function auditLlmsTxt(
  domain: string,
  opts: { timeout?: number; userAgent?: string } = {},
): Promise<SignalResult> {
  try {
    const res = await fetchWithTimeout(
      `https://${domain}/llms.txt`,
      opts.timeout ?? 10_000,
      opts.userAgent,
    );

    if (!res.ok || res.status === 404) {
      return {
        signal: "llms_txt",
        pass: false,
        weight: 14,
        detail: "No llms.txt found",
        fix: "Run: citekit generate-llms-txt --name <brand> --domain <domain>  — highest-impact GEO fix",
      };
    }

    const body = res.body.trim();
    const hasHeading = /^#\s+\S/m.test(body);
    const hasContent = body.length >= 50;

    if (!hasHeading || !hasContent) {
      return {
        signal: "llms_txt",
        pass: false,
        weight: 14,
        detail: "llms.txt exists but is empty or missing required # heading",
        fix: "Add a markdown heading and at least one section describing your brand and key pages",
      };
    }

    return {
      signal: "llms_txt",
      pass: true,
      weight: 14,
      detail: `llms.txt found with ${body.split("\n").length} lines`,
    };
  } catch {
    return {
      signal: "llms_txt",
      pass: false,
      weight: 14,
      detail: "llms.txt fetch failed",
      fix: "Run: citekit generate-llms-txt --name <brand> --domain <domain>",
    };
  }
}
