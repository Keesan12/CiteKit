export interface FetchResult {
  ok: boolean;
  status: number;
  body: string;
  redirected: boolean;
  finalUrl: string;
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 10_000,
  userAgent = "CiteKit-audit/1.0 (+https://github.com/Keesan12/CiteKit)",
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": userAgent },
    });

    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body,
      redirected: res.redirected,
      finalUrl: res.url,
    };
  } finally {
    clearTimeout(timer);
  }
}
