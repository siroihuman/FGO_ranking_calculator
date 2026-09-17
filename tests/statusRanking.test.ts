import { describe, expect, it } from "vitest";
import { buildStatusRanking } from "../src/ranking/statusRanking.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

const servants: ServantStatusRecord[] = [
  {
    id: "official:1",
    source: "official",
    pageUrl: "https://example.com/1",
    pageId: "1",
    no: "001",
    name: "A",
    className: "Saber",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 12000, atkMax: 13000, hp100: 13000, atk100: 14000 },
  },
  {
    id: "original:2",
    source: "original",
    pageUrl: "https://example.com/2",
    pageId: "2",
    no: "002'",
    name: "B",
    className: "Archer",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 12500, atkMax: 13000, hp100: 13500, atk100: 14000 },
  },
  {
    id: "original:3",
    source: "original",
    pageUrl: "https://example.com/3",
    pageId: "3",
    no: "003'",
    name: "C",
    className: "Caster",
    rarity: 4,
    status: { maxLevel: 80, hpMax: 11000, atkMax: 11000 },
  },
];

describe("buildStatusRanking", () => {
  it("adds Fou bonus and uses competition ranking for ties", () => {
    const result = buildStatusRanking(servants, {
      kind: "atk",
      level: "max",
      fou: 1000,
    });

    expect(result.map(({ rank, value }) => [rank, value])).toEqual([
      [1, 14000],
      [1, 14000],
      [3, 12000],
    ]);
  });

  it("filters by source", () => {
    const result = buildStatusRanking(servants, {
      kind: "hp",
      level: "max",
      fou: 0,
      source: "official",
    });

    expect(result).toHaveLength(1);
    expect(result[0].servant.id).toBe("official:1");
  });

  it("omits servants without the requested level data", () => {
    const result = buildStatusRanking(servants, {
      kind: "hp",
      level: 100,
      fou: 0,
    });

    expect(result.map(({ servant }) => servant.id)).not.toContain("original:3");
  });
});
