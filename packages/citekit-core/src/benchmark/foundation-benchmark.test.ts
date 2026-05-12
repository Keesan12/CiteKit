import { describe, expect, it } from "vitest";
import { MARKET_SCOREBOARD_TARGETS, getScoreboardPreset } from "./company-universe";

describe("scoreboard presets", () => {
  it("ships a market preset with at least 25 real domains", () => {
    expect(MARKET_SCOREBOARD_TARGETS.length).toBeGreaterThanOrEqual(25);
    expect(getScoreboardPreset("founders")[0]?.founderOwned).toBe(true);
    expect(new Set(MARKET_SCOREBOARD_TARGETS.map((target) => target.domain)).size).toBe(MARKET_SCOREBOARD_TARGETS.length);
  });
});
