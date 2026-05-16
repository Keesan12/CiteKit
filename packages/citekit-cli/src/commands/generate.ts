import { writeFileSync } from "node:fs";
import { Command } from "commander";
import ora from "ora";
import { crawlSite, type CrawlResult } from "citekit-core";
import { addExamples, addJsonOption, normalizeCliDomain, printJson } from "./shared";

function extractTopics(site: CrawlResult): string[] {
  const words = new Map<string, number>();
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "your", "our", "are", "was",
    "you", "not", "have", "from", "but", "all", "can", "more", "also", "get",
    "how", "why", "what", "who", "when", "where", "will", "use", "used", "using",
  ]);

  for (const page of site.pages) {
    const tokens = page.markdownContent
      .toLowerCase()
      .replace(/[^a-z\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w));
    for (const token of tokens) {
      words.set(token, (words.get(token) ?? 0) + 1);
    }
  }

  return Array.from(words.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function extractFaqQuestions(site: CrawlResult): string[] {
  const questions: string[] = [];
  for (const page of site.pages) {
    for (const raw of page.schemaJsonExisting) {
      try {
        const parsed: unknown = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item && typeof item === "object") {
            const schema = item as Record<string, unknown>;
            if (schema["@type"] === "FAQPage") {
              const entries = schema["mainEntity"];
              if (Array.isArray(entries)) {
                for (const entry of entries) {
                  if (entry && typeof entry === "object") {
                    const q = (entry as Record<string, unknown>)["name"];
                    if (typeof q === "string") questions.push(q);
                  }
                }
              }
            }
          }
        }
      } catch { /* skip */ }
    }
  }
  return questions.slice(0, 6);
}

function buildLlmsTxt(name: string, domain: string, site: CrawlResult): string {
  const homepage = site.pages[0];
  const description = homepage
    ? homepage.markdownContent.slice(0, 200).replace(/\s+/g, " ").trim()
    : `${name} — official website`;

  const topics = extractTopics(site);
  const faqs = extractFaqQuestions(site);

  const keyPages = site.pages
    .filter((p) => p.title && p.url !== `https://${domain}` && p.url !== `https://${domain}/`)
    .slice(0, 8)
    .map((p) => `- [${p.title}](${p.url})`);

  const lines: string[] = [
    `# ${name}`,
    "",
    `> ${description}`,
    "",
    "## About",
    `${name} is available at https://${domain}.`,
    "",
  ];

  if (topics.length > 0) {
    lines.push("## Topics", ...topics.map((t) => `- ${t}`), "");
  }

  if (keyPages.length > 0) {
    lines.push("## Key Pages", ...keyPages, "");
  }

  if (faqs.length > 0) {
    lines.push("## Questions Answered", ...faqs.map((q) => `- ${q}`), "");
  }

  lines.push(
    "## AI Crawler Access",
    "This site permits access by GPTBot, ClaudeBot, PerplexityBot, and Google-Extended.",
    "All content on this domain is available for AI training and citation.",
  );

  return lines.join("\n");
}

export const generateCommand = addExamples(
  addJsonOption(
    new Command("generate-llms-txt")
      .summary("Generate llms.txt for AI crawler access")
      .description(
        "Crawl your domain and generate a production-ready llms.txt file.\n" +
        "llms.txt tells GPTBot, ClaudeBot, PerplexityBot, and Googlebot which content\n" +
        "is AI-readable and authoritative — the highest-impact GEO fix for most sites.",
      )
      .requiredOption("--name <name>", "Brand name")
      .requiredOption("--domain <domain>", "Brand domain")
      .option("--output <path>", "Write output to a file instead of stdout")
      .option("--max-pages <count>", "Max pages to crawl", "5"),
  ).action(async (options: { name: string; domain: string; output?: string; maxPages: string; json?: boolean }) => {
    const domain = normalizeCliDomain(options.domain);
    const maxPages = Math.min(Math.max(1, Number.parseInt(options.maxPages, 10) || 5), 20);

    const spinner = ora(`Crawling ${domain}…`).start();
    let site: CrawlResult;
    try {
      site = await crawlSite(domain, maxPages);
      spinner.succeed(`Crawled ${site.pages.length} page${site.pages.length === 1 ? "" : "s"}`);
    } catch (err) {
      spinner.fail(`Crawl failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
      return;
    }

    const content = buildLlmsTxt(options.name, domain, site);

    if (options.json) {
      printJson({ domain, llms_txt: content, deploy_url: `https://${domain}/llms.txt` });
      return;
    }

    if (options.output) {
      writeFileSync(options.output, content, "utf8");
      process.stdout.write(
        `Written to ${options.output}\n` +
        `Deploy at: https://${domain}/llms.txt\n` +
        `Also create /llms-full.txt with complete page content for deeper AI indexing.\n`,
      );
    } else {
      process.stdout.write(`${content}\n`);
      process.stdout.write(
        `\n# Deploy this file at: https://${domain}/llms.txt\n` +
        `# Also create /llms-full.txt with complete page text for deeper AI indexing.\n`,
      );
    }
  }),
  [
    'citekit generate-llms-txt --name "Acme Corp" --domain acme.com',
    'citekit generate-llms-txt --name "Acme Corp" --domain acme.com --output public/llms.txt',
    'citekit generate-llms-txt --name "Acme Corp" --domain acme.com --json',
  ],
);
