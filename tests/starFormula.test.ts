import { describe, expect, it } from "vitest";
import { calculateNormalCardExpectedStars } from "../src/formulas/cardStars.js";

describe("normal command-card star expectation", () => {
  it("calculates Quick expected stars from source SR and position", () => {
    expect(calculateNormalCardExpectedStars({
      starRate: 8.1,
      cardType: "quick",
      position: 3,
      hits: 5,
    })).toBeCloseTo(9.405, 10);
  });

  it("applies Quick/Mighty first-card bonus and overkill per hit", () => {
    expect(calculateNormalCardExpectedStars({
      starRate: 8.1,
      cardType: "quick",
      position: 3,
      hits: 5,
      firstCardBonus: "quick",
    })).toBeCloseTo(10.405, 10);
    expect(calculateNormalCardExpectedStars({
      starRate: 8.1,
      cardType: "quick",
      position: 3,
      hits: 5,
      overkillHits: 3,
    })).toBeCloseTo(10.305, 10);
  });

  it("applies critical star bonus", () => {
    expect(calculateNormalCardExpectedStars({
      starRate: 8.1,
      cardType: "quick",
      position: 3,
      hits: 5,
      critical: true,
    })).toBeCloseTo(10.405, 10);
  });
});
