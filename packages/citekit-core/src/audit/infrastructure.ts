import type { SignalResult } from "../types/index";
import { fetchWithTimeout } from "../utils/fetch";

export async function auditInfrastructure(
  domain: string,
  homepageHtml: string,
  opts: { timeout?: number; userAgent?: string } = {},
): Promise<SignalResult[]> {
  const [httpsResult, sitemapResult] = await Promise.all([
    checkHttpsRedirect(domain, opts),
    checkSitemap(domain, opts),
  ]);

  const canonicalResult = checkCanonical(homepageHtml, domain);

  return [httpsResult, sitemapResult, canonicalResult];
}

async function checkHttpsRedirect(
  domain: string,
  opts: { timeout?: number; userAgent?: string },
): Promise<SignalResult> {
  try {
    const res = await fetchWithTimeout(
      `http://${domain}/`,
      opts.timeout ?? 10_000,
      opts.userAgent,
    );

    const redirectedToHttps =
      res.redirected && res.finalUrl.startsWith("https://");
    const isHttps = res.finalUrl.startsWith("https://");

    return {
      signal: "infra_https",
      pass: isHttps,
      weight: 2,
      detail: isHttps
        ? redirectedToHttps
          ? "HTTP redirects to HTTPS"
          : "Site serves over HTTPS"
        : "Site does not redirect HTTP to HTTPS",
      fix: isHttps
        ? undefined
        : "Enable HTTPS and add a 301 redirect from http:// to https:// — required for AI crawler trust",
    };
  } catch {
    return {
      signal: "infra_https",
      pass: false,
      weight: 2,
      detail: "Could not verify HTTPS redirect",
      fix: "Enable HTTPS on your domain",
    };
  }
}

async function checkSitemap(
  domain: string,
  opts: { timeout?: number; userAgent?: string },
): Promise<SignalResult> {
  try {
    const res = await fetchWithTimeout(
      `https://${domain}/sitemap.xml`,
      opts.timeout ?? 10_000,
      opts.userAgent,
    );

    const valid =
      res.ok &&
      (res.body.includes("<urlset") || res.body.includes("<sitemapindex"));

    return {
      signal: "infra_sitemap",
      pass: valid,
      weight: 3,
      detail: valid
        ? "sitemap.xml found and valid"
        : res.ok
          ? "sitemap.xml found but missing <urlset> or <sitemapindex>"
          : "No sitemap.xml found",
      fix: valid
        ? undefined
        : "Create and publish /sitemap.xml — search engines and AI crawlers use it to discover all your pages",
    };
  } catch {
    return {
      signal: "infra_sitemap",
      pass: false,
      weight: 3,
      detail: "sitemap.xml fetch failed",
      fix: "Create and publish /sitemap.xml",
    };
  }
}

function checkCanonical(html: string, domain: string): SignalResult {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);

  if (!match) {
    return {
      signal: "infra_canonical",
      pass: false,
      weight: 2,
      detail: "No canonical link tag found",
      fix: 'Add <link rel="canonical" href="https://yourdomain.com/"> to the <head> — prevents duplicate content penalties',
    };
  }

  const href = match[0].match(/href=["']([^"']+)["']/i)?.[1] ?? "";
  const pointsToDomain = href.includes(domain);

  return {
    signal: "infra_canonical",
    pass: pointsToDomain,
    weight: 2,
    detail: pointsToDomain
      ? `Canonical tag points to ${href}`
      : `Canonical tag found but does not point to ${domain}`,
    fix: pointsToDomain
      ? undefined
      : `Update canonical href to https://${domain}/`,
  };
}
