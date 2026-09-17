import { describe, expect, it } from "vitest";
import { buildNpRanking, type NpRankingServant } from "../src/ranking/npRanking.js";

const servants: NpRankingServant[] = [
  {
    id: "original:1", source: "original", pageUrl: "https://example.test/1", no: "001", name: "A",
    npGainRate: 0.50, quickHits: 4, artsHits: 3, busterHits: 1, extraHits: 4,
    cards: { quick: 1, arts: 2, buster: 2 },
  },
  {
    id: "official:2", source: "official", pageUrl: "https://example.test/2", no: "002", name: "B",
    npGainRate: 0.50, quickHits: 4, artsHits: 3, busterHits: 1, extraHits: 4,
    cards: { quick: 1, arts: 2, buster: 2 },
  },
  {
    id: "official:3", source: "official", pageUrl: "https://example.test/3", no: "003", name: "C",
    npGainRate: 0.70, quickHits: 5, artsHits: 3, busterHits: 1, extraHits: 4,
    cards: { quick: 0, arts: 2, buster: 3 },
  },
];

describe("buildNpRanking", () => {
  it("uses competition ranking for equal NP values", () => {
    const rows = buildNpRanking(servants, { cardType: "arts", position: 1 });
    expect(rows.map((row) => [row.name, row.rank])).toEqual([
      ["C", 1],
      ["A", 2],
      ["B", 2],
    ]);
  });

  it("does not rank a command card the servant does not own", () => {
    const rows = buildNpRanking(servants, { cardType: "quick", position: 1 });
    expect(rows.map((row) => row.name)).toEqual(["A", "B"]);
  });

  it("supports source filtering", () => {
    const rows = buildNpRanking(servants, { cardType: "arts", position: 1, source: "original" });
    expect(rows.map((row) => row.name)).toEqual(["A"]);
  });
});
