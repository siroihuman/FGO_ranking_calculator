import { describe, expect, it } from "vitest";
import { buildBuffRanking } from "../src/ranking/buffRanking.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

function servant(): ServantStatusRecord {
  return {
    id: "original:buff",
    source: "original",
    pageUrl: "https://example.test",
    pageId: "buff",
    no: "902'",
    name: "Buff Test",
    className: "Rider",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 10000, atkMax: 10000 },
    skills: [
      {
        slot: 1,
        name: "Party",
        strengthened: false,
        effects: [
          {
            type: "attack",
            target: "all_allies",
            rawText: "味方全体の攻撃力をアップ",
            value: 20,
            unit: "percent",
            probabilistic: false,
            isSpecialAttack: false,
          },
          {
            type: "np_gain",
            target: "all_allies",
            rawText: "＆NP獲得量をアップ",
            value: 20,
            unit: "percent",
            probabilistic: false,
            isSpecialAttack: false,
          },
        ],
      },
      {
        slot: 2,
        name: "Target",
        strengthened: false,
        effects: [
          {
            type: "card_performance",
            target: "ally_single",
            rawText: "味方単体のQuickカード性能をアップ",
            value: 50,
            unit: "percent",
            cardType: "quick",
            probabilistic: false,
            isSpecialAttack: false,
          },
          {
            type: "special_attack",
            target: "ally_single",
            rawText: "＆〔竜〕特攻状態を付与",
            value: 50,
            unit: "percent",
            probabilistic: false,
            isSpecialAttack: true,
          },
        ],
      },
      {
        slot: 3,
        name: "Self",
        strengthened: false,
        effects: [
          {
            type: "noble_phantasm_damage",
            target: "self",
            rawText: "自身の宝具威力をアップ",
            value: 30,
            unit: "percent",
            probabilistic: true,
            activationRatePercent: 80,
            isSpecialAttack: false,
          },
          {
            type: "attack",
            target: "self",
            rawText: "HP50%以下の時、自身の攻撃力をアップ",
            value: 40,
            unit: "percent",
            probabilistic: false,
            conditionText: "HP50%以下の時",
            isSpecialAttack: false,
          },
        ],
      },
    ],
    classSkills: [{
      name: "Passive",
      effects: [{
        type: "critical_damage",
        target: "self",
        rawText: "自身のクリティカル威力をアップ",
        value: 10,
        unit: "percent",
        probabilistic: false,
        isSpecialAttack: false,
      }],
    }],
  };
}

describe("buildBuffRanking", () => {
  it("sums buffs the servant can receive on self", () => {
    const [row] = buildBuffRanking([servant()], { target: "self" });
    expect(row.breakdown).toMatchObject({
      attack: 20,
      noblePhantasmDamage: 30,
      criticalDamage: 10,
      npGain: 20,
      total: 80,
    });
    expect(row.usesProbabilisticEffect).toBe(true);
  });

  it("sums party and targeted buffs transferable to the same ally and excludes special attack", () => {
    const [row] = buildBuffRanking([servant()], { target: "ally" });
    expect(row.breakdown).toMatchObject({
      attack: 20,
      quick: 50,
      npGain: 20,
      total: 90,
    });
    expect(row.appliedEffects.some((effect) => effect.isSpecialAttack)).toBe(false);
  });

  it("can rank by one buff category", () => {
    const [row] = buildBuffRanking([servant()], {
      target: "ally",
      category: "quick",
    });
    expect(row.value).toBe(50);
  });

  it("only includes external conditional buffs when conditional mode is on", () => {
    const [off] = buildBuffRanking([servant()], {
      target: "self",
      conditionalEffects: false,
    });
    const [on] = buildBuffRanking([servant()], {
      target: "self",
      conditionalEffects: true,
    });
    expect(on.value).toBe(off.value + 40);
  });
});
