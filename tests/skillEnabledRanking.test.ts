import { describe, expect, it } from "vitest";
import { buildNoblePhantasmDamageRanking } from "../src/ranking/noblePhantasmDamageRanking.js";
import { buildNoblePhantasmNpRanking } from "../src/ranking/noblePhantasmNpRanking.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

function servant(): ServantStatusRecord {
  return {
    id: "original:skill-test",
    source: "original",
    pageUrl: "https://example.test",
    pageId: "skill-test",
    no: "900'",
    name: "Skill Test",
    className: "Caster",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 10000, atkMax: 10000 },
    hidden: { npGainRate: 0.8, noblePhantasmHits: 4 },
    noblePhantasm: {
      cardType: "arts",
      targetScope: "all",
      hitCount: 4,
      damageMultiplierPermilleByLevel: [4500, 4500, 4500, 4500, 4500],
      effectRows: [
        { rawText: "自身の宝具威力をアップ(3T)<OC:効果UP>", values: [20, 25, 30, 35, 40], phase: "before_attack" },
        { rawText: "＆NP獲得量をアップ(3T)", values: [20], phase: "before_attack" },
        { rawText: "敵全体に強力な攻撃[Lv]", values: [450, 600, 675, 712.5, 750], phase: "attack" },
      ],
    },
    skills: [{
      slot: 1,
      name: "Active",
      strengthened: false,
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
          type: "np_gain",
          target: "self",
          rawText: "＆NP獲得量をアップ",
          value: 50,
          unit: "percent",
          probabilistic: false,
          isSpecialAttack: false,
        },
      ],
    }],
    classSkills: [{
      name: "Passive",
      effects: [{
        type: "card_performance",
        target: "self",
        rawText: "自身のArtsカード性能をアップ",
        value: 10,
        unit: "percent",
        cardType: "arts",
        probabilistic: false,
        isSpecialAttack: false,
      }],
    }],
  };
}

describe("skill-enabled noble phantasm rankings", () => {
  it("applies active skills to NP damage while keeping NP pre-attack effects in both modes", () => {
    const withoutSkills = buildNoblePhantasmDamageRanking([servant()], { fou: 0, skills: false })[0];
    const withSkills = buildNoblePhantasmDamageRanking([servant()], { fou: 0, skills: true })[0];
    expect(withoutSkills.appliedEffects.some((effect) => effect.type === "noble_phantasm_damage")).toBe(true);
    expect(withSkills.averageDamage).toBeGreaterThan(withoutSkills.averageDamage);
  });

  it("applies NP gain skills to Noble Phantasm recharge", () => {
    const withoutSkills = buildNoblePhantasmNpRanking([servant()], { skills: false })[0];
    const withSkills = buildNoblePhantasmNpRanking([servant()], { skills: true })[0];
    expect(withSkills.npUnits).toBeGreaterThan(withoutSkills.npUnits);
  });
});
