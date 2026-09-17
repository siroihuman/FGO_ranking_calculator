import { describe, expect, it } from "vitest";
import { buildNoblePhantasmDamageRanking } from "../src/ranking/noblePhantasmDamageRanking.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

function servant(name: string, atk: number, multiplier: number): ServantStatusRecord {
  return {
    id: `original:${name}`,
    source: "original",
    pageUrl: "https://example.test",
    pageId: name,
    no: name,
    name,
    className: "Saber",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 10000, atkMax: atk, atk100: atk + 1000, hp100: 11000 },
    noblePhantasm: {
      cardType: "buster",
      targetScope: "all",
      hitCount: 1,
      damageMultiplierPermilleByLevel: [multiplier, multiplier, multiplier, multiplier, multiplier],
      effectRows: [],
    },
  };
}

describe("skillless noble phantasm damage ranking", () => {
  it("calculates the full 0.900-1.099 random range and ranks by its average", () => {
    const result = buildNoblePhantasmDamageRanking([
      servant("A", 10000, 3000),
      servant("B", 10000, 4000),
    ], { fou: 0 });

    expect(result.map(({ servant }) => servant.name)).toEqual(["B", "A"]);
    expect(result[0].minimumDamage).toBeLessThan(result[0].averageDamage);
    expect(result[0].averageDamage).toBeLessThan(result[0].maximumDamage);
  });

  it("uses competition ranking for identical damage", () => {
    const result = buildNoblePhantasmDamageRanking([
      servant("A", 10000, 3000),
      servant("B", 10000, 3000),
      servant("C", 9000, 3000),
    ], { fou: 0 });
    expect(result.map(({ rank }) => rank)).toEqual([1, 1, 3]);
  });

  it("supports level and Fou options", () => {
    const [max] = buildNoblePhantasmDamageRanking([servant("A", 10000, 3000)], {
      level: "max",
      fou: 0,
    });
    const [level100] = buildNoblePhantasmDamageRanking([servant("A", 10000, 3000)], {
      level: 100,
      fou: 1000,
    });
    expect(level100.attack).toBe(12000);
    expect(level100.averageDamage).toBeGreaterThan(max.averageDamage);
  });
});
