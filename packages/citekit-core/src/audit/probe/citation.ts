import type { SignalResult } from "../../types/index";

interface CitationProbeOptions {
  citationApiKey: string;
  domain: string;
  category?: string;
  timeout?: number;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function probeCitation(opts: CitationProbeOptions): Promise<SignalResult> {
  const { citationApiKey, domain, category = "tools", timeout = 20_000 } = opts;

  const prompt = `What are the best ${category}? List the top options with their websites.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${citationApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      return {
        signal: "citation_probe",
        pass: false,
        weight: 20,
        detail: `Citation probe API returned HTTP ${res.status}`,
        fix: "Ensure CITATION_API_KEY is a valid OpenAI key with gpt-4o-mini access",
      };
    }

    const data = (await res.json()) as OpenAIResponse;
    const answer = data.choices?.[0]?.message?.content ?? "";
    const cited = answer.toLowerCase().includes(domain.toLowerCase());

    return {
      signal: "citation_probe",
      pass: cited,
      weight: 20,
      detail: cited
        ? `Domain ${domain} appeared in AI response to "${prompt}"`
        : `Domain ${domain} not found in AI response — not currently cited by GPT-4o-mini`,
      fix: cited
        ? undefined
        : "Address the structural gaps above to increase citation likelihood — schema, llms.txt, and content depth are the strongest levers",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      signal: "citation_probe",
      pass: false,
      weight: 20,
      detail: `Citation probe failed: ${message}`,
      fix: "Check your CITATION_API_KEY and network access, then re-run with --citation-key",
    };
  } finally {
    clearTimeout(timer);
  }
}
