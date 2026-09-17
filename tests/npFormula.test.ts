import { describe, expect, it } from "vitest";
import { calculateNormalCardNp, sourceNpRateToUnits } from "../src/formulas/cardNp.js";

describe("normal command-card NP formula", () => {
  it("converts source N/A into the simulator's 0.01%-gauge units", () => {
    expect(sourceNpRateToUnits(0.43)).toBe(43);
  });

  it("matches Arts position and first-card NP bonuses", () => {
    expect(calculateNormalCardNp({ npGainRate: 0.43, cardType: "arts", position: 1, hits: 4 })).toBe(516);
    expect(calculateNormalCardNp({
      npGainRate: 0.43,
      cardType: "arts",
      position: 3,
      hits: 4,
      firstCardBonus: "arts",
    })).toBe(1204);
  });

  it("applies critical and overkill per hit", () => {
    expect(calculateNormalCardNp({
      npGainRate: 0.43,
      cardType: "quick",
      position: 3,
      hits: 5,
      critical: true,
    })).toBe(860);
    expect(calculateNormalCardNp({
      npGainRate: 0.43,
      cardType: "quick",
      position: 3,
      hits: 5,
      overkillHits: 3,
    })).toBe(559);
  });

  it("allows Buster to gain NP from an Arts/Mighty first-card bonus", () => {
    expect(calculateNormalCardNp({ npGainRate: 0.43, cardType: "buster", position: 3, hits: 4 })).toBe(0);
    expect(calculateNormalCardNp({
      npGainRate: 0.43,
      cardType: "buster",
      position: 3,
      hits: 4,
      firstCardBonus: "arts",
    })).toBe(172);
  });
});
