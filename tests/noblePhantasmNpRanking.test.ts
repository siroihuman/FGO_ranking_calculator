import { describe, expect, it } from "vitest";
import { calculateNoblePhantasmNp } from "../src/formulas/noblePhantasmNp.js";
import { buildNoblePhantasmNpRanking } from "../src/ranking/noblePhantasmNpRanking.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

function servant(name: string, npGainRate: number, hits: number): ServantStatusRecord {
  return {
    id: `original:${name}`,
    source: "original",
    pageUrl: "https://example.test",
    pageId: name,
    no: name,
    name,
    className: "Archer",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 10000, atkMax: 10000 },
    hidden: { npGainRate, noblePhantasmHits: hits },
    noblePhantasm: {
      cardType: "quick",
      targetScope: "all",
      hitCount: hits,
      damageMultiplierPermilleByLevel: [6000, 8000, 9000, 9500, 10000],
      effectRows: [],
    },
  };
}

describe("noble phantasm NP recharge", () => {
  it("adds independently calculated NP for each target", () => {
    const one = calculateNoblePhantasmNp({
      npGainRate: 0.5,
      cardType: "quick",
      hits: 5,
      enemyCount: 1,
    });
    const three = calculateNoblePhantasmNp({
      npGainRate: 0.5,
      cardType: "quick",
      hits: 5,
      enemyCount: 3,
    });
    expect(three).toBe(one * 3);
  });

  it("applies overkill per Hit before target totals are added", () => {
    const normal = calculateNoblePhantasmNp({ npGainRate: 0.5, cardType: "arts", hits: 4 });
    const overkill = calculateNoblePhantasmNp({
      npGainRate: 0.5,
      cardType: "arts",
      hits: 4,
      overkillHitsPerEnemy: 2,
    });
    expect(overkill).toBeGreaterThan(normal);
  });

  it("ranks by recovered NP and uses competition ranks for ties", () => {
    const result = buildNoblePhantasmNpRanking([
      servant("A", 0.5, 5),
      servant("B", 0.5, 5),
      servant("C", 0.4, 5),
    ]);
    expect(result.map(({ rank }) => rank)).toEqual([1, 1, 3]);
    expect(result[0].npPercent).toBeGreaterThan(result[2].npPercent);
  });
});
