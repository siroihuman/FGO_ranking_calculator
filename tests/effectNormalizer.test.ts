import { describe, expect, it } from "vitest";
import { normalizeRankingEffect } from "../src/effects/normalizeEffect.js";

describe("normalizeRankingEffect", () => {
  it("normalizes card performance and inherited targets", () => {
    const quick = normalizeRankingEffect("自身のQuickカード性能をアップ[Lv](3T)", 30);
    expect(quick).toMatchObject({
      type: "card_performance",
      target: "self",
      cardType: "quick",
      value: 30,
      durationTurns: 3,
      unit: "percent",
    });

    const charge = normalizeRankingEffect("＆NPを増やす[Lv]", 30, quick.target);
    expect(charge).toMatchObject({
      type: "np_charge",
      target: "self",
      value: 30,
      unit: "np_percent",
    });
  });

  it("stores debuffs as negative target modifiers", () => {
    expect(normalizeRankingEffect("敵全体の防御力をダウン[Lv](3T)", 20)).toMatchObject({
      type: "defense",
      target: "all_enemies",
      value: -20,
    });
  });

  it("marks special attacks separately", () => {
    expect(normalizeRankingEffect("自身に〔神性〕特攻状態を付与", 10)).toMatchObject({
      type: "special_attack",
      target: "self",
      value: 10,
      isSpecialAttack: true,
    });
  });

  it("marks probability metadata", () => {
    expect(normalizeRankingEffect("自身の攻撃力を確率80%でアップ(3T)", 30)).toMatchObject({
      probabilistic: true,
      activationRatePercent: 80,
    });
  });
});
