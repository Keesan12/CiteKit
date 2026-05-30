export interface SignalResult {
  signal: string;
  pass: boolean;
  weight: number;
  detail?: string | undefined;
  fix?: string | undefined;
}

export interface AuditOptions {
  citationApiKey?: string;
  timeout?: number;
  userAgent?: string;
}

export interface FixEntry {
  signal: string;
  title: string;
  effort: "low" | "medium" | "high";
  predicted_lift: number;
  citekit_command?: string | undefined;
}

export interface AuditReport {
  domain: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  signals: SignalResult[];
  fixes: FixEntry[];
  auditedAt: string;
}
