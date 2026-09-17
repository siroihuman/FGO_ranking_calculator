import { describe, expect, it } from "vitest";
import { resolveRankingModifierTotals } from "../src/effects/rankingModifiers.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

function baseServant(): ServantStatusRecord {
  return {
    id: "original:test",
    source: "original",
    pageUrl: "https://example.test",
    pageId: "test",
    no: "001'",
    name: "Test",
    className: "Saber",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 10000, atkMax: 10000 },
    noblePhantasm: {
      cardType: "buster",
      targetScope: "all",
      hitCount: 1,
      damageMultiplierPermilleByLevel: [3000, 3000, 3000, 3000, 3000],
      effectRows: [
        { rawText: "自身の宝具威力をアップ(3T)<OC:効果UP>", values: [10, 15, 20, 25, 30], phase: "before_attack" },
        { rawText: "敵全体に強力な攻撃[Lv]", values: [300, 400, 450, 475, 500], phase: "attack" },
      ],
    },
    skills: [
      {
        slot: 1,
        name: "Before",
        strengthened: false,
        effects: [{
          type: "attack",
          target: "self",
          rawText: "自身の攻撃力をアップ",
          value: 20,
          unit: "percent",
          probabilistic: false,
          isSpecialAttack: false,
        }],
      },
      {
        slot: 1,
        name: "After",
        strengthened: true,
        effects: [
          {
            type: "attack",
            target: "self",
            rawText: "自身の攻撃力をアップ",
            value: 30,
            unit: "percent",
            probabilistic: false,
            isSpecialAttack: false,
          },
          {
            type: "special_attack",
            target: "self",
            rawText: "自身に〔竜〕特攻状態を付与",
            value: 50,
            unit: "percent",
            probabilistic: false,
            isSpecialAttack: true,
          },
        ],
      },
    ],
    classSkills: [{
      name: "騎乗",
      effects: [{
        type: "card_performance",
        target: "self",
        rawText: "自身のBusterカード性能をアップ",
        value: 10,
        unit: "percent",
        cardType: "buster",
        probabilistic: false,
        isSpecialAttack: false,
      }],
    }],
  };
}

describe("resolveRankingModifierTotals", () => {
  it("uses class skills, strengthened active skills and NP pre-attack effects", () => {
    const totals = resolveRankingModifierTotals(baseServant(), {
      includeSkills: true,
      cardType: "buster",
      noblePhantasm: true,
      overchargeStage: 3,
      includeNoblePhantasmPreAttackEffects: true,
    });
    expect(totals.cardPerformanceModPermille).toBe(100);
    expect(totals.attackModPermille).toBe(300);
    expect(totals.npDamageModPermille).toBe(200);
    expect(totals.appliedEffects.some((effect) => effect.isSpecialAttack)).toBe(false);
  });

  it("does not use active skills when skill mode is off", () => {
    const totals = resolveRankingModifierTotals(baseServant(), {
      includeSkills: false,
      cardType: "buster",
      noblePhantasm: true,
    });
    expect(totals.attackModPermille).toBe(0);
    expect(totals.cardPerformanceModPermille).toBe(100);
  });
});
