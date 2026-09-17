import { describe, expect, it } from "vitest";
import { buildStarRanking, type StarRankingServant } from "../src/ranking/starRanking.js";

const servants: StarRankingServant[] = [
  {
    id: "original:1", source: "original", pageUrl: "https://example.test/1", no: "001", name: "A",
    starRate: 8.0, quickHits: 5, artsHits: 4, busterHits: 1, extraHits: 4,
    cards: { quick: 1, arts: 2, buster: 2 },
  },
  {
    id: "official:2", source: "official", pageUrl: "https://example.test/2", no: "002", name: "B",
    starRate: 8.0, quickHits: 5, artsHits: 4, busterHits: 1, extraHits: 4,
    cards: { quick: 1, arts: 2, buster: 2 },
  },
  {
    id: "official:3", source: "official", pageUrl: "https://example.test/3", no: "003", name: "C",
    starRate: 15.0, quickHits: 5, artsHits: 4, busterHits: 1, extraHits: 4,
    cards: { quick: 0, arts: 2, buster: 3 },
  },
];

describe("buildStarRanking", () => {
  it("ranks by expected stars with competition ties", () => {
    const rows = buildStarRanking(servants, { cardType: "arts", position: 1 });
    expect(rows.map((row) => [row.name, row.rank])).toEqual([
      ["C", 1],
      ["A", 2],
      ["B", 2],
    ]);
  });

  it("excludes command cards the servant does not own", () => {
    const rows = buildStarRanking(servants, { cardType: "quick", position: 3 });
    expect(rows.map((row) => row.name)).toEqual(["A", "B"]);
  });
});
