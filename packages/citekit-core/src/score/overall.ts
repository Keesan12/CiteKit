import type { SignalResult } from "../types/index";
import { SIGNAL_WEIGHTS, MAX_SCORE_WITHOUT_PROBE, MAX_SCORE_WITH_PROBE } from "./dimensions";

export type ScoreGrade = "A" | "B" | "C" | "D" | "F";

export function computeScore(signals: SignalResult[]): number {
  const hasProbe = signals.some((s) => s.signal === "citation_probe");
  const maxScore = hasProbe ? MAX_SCORE_WITH_PROBE : MAX_SCORE_WITHOUT_PROBE;

  const earned = signals
    .filter((s) => s.pass)
    .reduce((sum, s) => {
      const weight = SIGNAL_WEIGHTS[s.signal] ?? s.weight;
      return sum + weight;
    }, 0);

  return Math.min(100, Math.round((earned / maxScore) * 100));
}

export function gradeFromScore(score: number): ScoreGrade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  if (score >= 25) return "D";
  return "F";
}
