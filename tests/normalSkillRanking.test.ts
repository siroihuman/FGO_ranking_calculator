import { describe, expect, it } from "vitest";
import { buildNpRanking, npRankingServantsFromStatus } from "../src/ranking/npRanking.js";
import { buildStarRanking, starRankingServantsFromStatus } from "../src/ranking/starRanking.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

const record: ServantStatusRecord = {
  id: "original:normal-skill",
  source: "original",
  pageUrl: "https://example.test",
  pageId: "normal-skill",
  no: "901'",
  name: "Normal Skill Test",
  className: "Archer",
  rarity: 5,
  status: { maxLevel: 90, hpMax: 10000, atkMax: 10000 },
  hidden: {
    npGainRate: 0.5,
    starRate: 8,
    quickHits: 5,
    artsHits: 3,
    busterHits: 1,
    extraHits: 4,
  },
  cards: { quick: 2, arts: 2, buster: 1 },
  skills: [{
    slot: 1,
    name: "Quick Support",
    strengthened: false,
    effects: [
      {
        type: "card_performance",
        target: "self",
        rawText: "自身のQuickカード性能をアップ",
        value: 50,
        unit: "percent",
        cardType: "quick",
        probabilistic: false,
        isSpecialAttack: false,
      },
      {
        type: "np_gain",
        target: "self",
        rawText: "＆NP獲得量をアップ",
        value: 50,
        unit: "percent",
        probabilistic: false,
        isSpecialAttack: false,
      },
      {
        type: "star_generation",
        target: "self",
        rawText: "＆スター発生率をアップ",
        value: 100,
        unit: "percent",
        probabilistic: false,
        isSpecialAttack: false,
      },
    ],
  }],
};

describe("skill-enabled normal card rankings", () => {
  it("increases Quick NP gain with card and NP gain buffs", () => {
    const servants = npRankingServantsFromStatus([record]);
    const off = buildNpRanking(servants, { cardType: "quick", position: 1, skills: false })[0];
    const on = buildNpRanking(servants, { cardType: "quick", position: 1, skills: true })[0];
    expect(on.npUnits).toBeGreaterThan(off.npUnits);
  });

  it("increases Quick expected stars with card and star-generation buffs", () => {
    const servants = starRankingServantsFromStatus([record]);
    const off = buildStarRanking(servants, { cardType: "quick", position: 1, skills: false })[0];
    const on = buildStarRanking(servants, { cardType: "quick", position: 1, skills: true })[0];
    expect(on.expectedStars).toBeGreaterThan(off.expectedStars);
  });
});
