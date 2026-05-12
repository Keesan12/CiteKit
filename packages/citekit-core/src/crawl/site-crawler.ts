import * as cheerio from "cheerio";
import got from "got";
import { sha256 } from "../utils/hash";
import { normalizeDomain } from "../utils/slug";
import { normalizeWhitespace } from "../utils/text";

export interface CrawledPage {
  url: string;
  title: string;
  markdownContent: string;
  schemaJsonExisting: string[];
  contentHash: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  llmsTxtExists: boolean;
}

function absolutize(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function pageToMarkdown($: cheerio.CheerioAPI): string {
  const text = $("main").text() || $("body").text();
  return normalizeWhitespace(text);
}

export async function crawlSite(domain: string, maxPages = 10): Promise<CrawlResult> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const normalizedHost = normalizeDomain(baseUrl);
  const visited = new Set<string>();
  const queue = [baseUrl];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) {
      continue;
    }

    visited.add(url);

    const response = await got(url, {
      timeout: { request: 30_000 },
      throwHttpErrors: false,
      headers: {
        "user-agent": "CiteOps crawler (+https://citeops.ai)",
      },
    });

    if (response.statusCode >= 400) {
      continue;
    }

    const $ = cheerio.load(response.body);
    const schemaJsonExisting = $('script[type="application/ld+json"]')
      .map((_, element) => $(element).text())
      .get()
      .filter(Boolean);

    const markdownContent = pageToMarkdown($);
    pages.push({
      url,
      title: $("title").text().trim(),
      markdownContent,
      schemaJsonExisting,
      contentHash: sha256(markdownContent),
    });

    $("a[href]")
      .map((_, element) => $(element).attr("href"))
      .get()
      .slice(0, 30)
      .forEach((href) => {
        if (!href) {
          return;
        }
        const absolute = absolutize(url, href);
        if (!absolute) {
          return;
        }
        if (!normalizeDomain(absolute).includes(normalizedHost)) {
          return;
        }
        if (!visited.has(absolute)) {
          queue.push(absolute);
        }
      });
  }

  const llmsTxtResponse = await got(`${baseUrl.replace(/\/$/, "")}/llms.txt`, {
    timeout: { request: 5_000 },
    throwHttpErrors: false,
    headers: { "user-agent": "CiteOps crawler (+https://citeops.ai)" },
  });

  return {
    pages,
    llmsTxtExists: llmsTxtResponse.statusCode < 400 && llmsTxtResponse.body.trim().length > 0,
  };
}
