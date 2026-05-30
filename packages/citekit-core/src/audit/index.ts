import type { AuditOptions, AuditReport, SignalResult } from "../types/index";
import { fetchWithTimeout } from "../utils/fetch";
import { auditRobots } from "./robots";
import { auditLlmsTxt } from "./llms-txt";
import { auditSchema } from "./schema";
import { auditContent } from "./content";
import { auditInfrastructure } from "./infrastructure";
import { auditMeta } from "./meta";
import { auditSpaGap } from "./spa-gap";
import { probeCitation } from "./probe/citation";
import { computeScore, gradeFromScore } from "../score/overall";
import { getFixesForSignals } from "../fixes/catalogue";

export async function runAudit(domain: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const normalizedDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const timeout = opts.timeout ?? 10_000;
  const fetchOpts: { timeout: number; userAgent?: string } = { timeout };
  if (opts.userAgent) fetchOpts.userAgent = opts.userAgent;

  const [robotsResult, llmsTxtResult, homepageRes] = await Promise.all([
    auditRobots(normalizedDomain, fetchOpts),
    auditLlmsTxt(normalizedDomain, fetchOpts),
    fetchWithTimeout(`https://${normalizedDomain}/`, timeout, opts.userAgent).catch(() => null),
  ]);

  const homepageHtml = homepageRes?.ok ? homepageRes.body : "";

  const [infraResults, schemaResults, contentResults, metaResults, spaGapResult] = await Promise.all([
    auditInfrastructure(normalizedDomain, homepageHtml, fetchOpts),
    Promise.resolve(auditSchema(homepageHtml)),
    Promise.resolve(auditContent(homepageHtml)),
    Promise.resolve(auditMeta(homepageHtml)),
    Promise.resolve(auditSpaGap(homepageHtml)),
  ]);

  const signals: SignalResult[] = [
    robotsResult,
    llmsTxtResult,
    ...schemaResults,
    ...contentResults,
    ...infraResults,
    ...metaResults,
    spaGapResult,
  ];

  if (opts.citationApiKey) {
    const citationResult = await probeCitation({
      citationApiKey: opts.citationApiKey,
      domain: normalizedDomain,
      timeout: opts.timeout ?? 20_000,
    });
    signals.push(citationResult);
  }

  const score = computeScore(signals);
  const grade = gradeFromScore(score);
  const fixes = getFixesForSignals(signals);

  return {
    domain: normalizedDomain,
    score,
    grade,
    signals,
    fixes,
    auditedAt: new Date().toISOString(),
  };
}

export type { AuditOptions, AuditReport, SignalResult } from "../types/index";
