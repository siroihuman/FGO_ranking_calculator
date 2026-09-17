import { describe, expect, it } from "vitest";
import { buildSystemDamageRanking } from "../src/system/systemDamageRanking.js";
import { buildSystemRefundRanking } from "../src/system/systemRefundRanking.js";
import type { SystemPreset } from "../src/system/presets.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

const PRESET: SystemPreset = {
  id: "test-arts",
  name: "Test Arts",
  cardType: "arts",
  initialNp: 100,
  actions: [],
  defaultActionsByWave: [[], [], []],
};

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
    hidden: { npGainRate: 0.5, noblePhantasmHits: 4 },
    noblePhantasm: {
      cardType: "arts",
      targetScope: "all",
      hitCount: 4,
      damageMultiplierPermilleByLevel: [4500, 4500, 4500, 4500, 4500],
      effectRows: [],
    },
    skills: [
      {
        slot: 1,
        name: "Three-turn attack",
        strengthened: false,
        ct: 6,
        effects: [{
          type: "attack",
          target: "self",
          rawText: "自身の攻撃力をアップ(3T)",
          value: 50,
          unit: "percent",
          durationTurns: 3,
          probabilistic: false,
          isSpecialAttack: false,
        }],
      },
      {
        slot: 2,
        name: "One-turn NP",
        strengthened: false,
        ct: 6,
        effects: [{
          type: "noble_phantasm_damage",
          target: "self",
          rawText: "自身の宝具威力をアップ(1T)",
          value: 100,
          unit: "percent",
          durationTurns: 1,
          probabilistic: false,
          isSpecialAttack: false,
        }],
      },
      {
        slot: 3,
        name: "Three-turn NP gain",
        strengthened: false,
        ct: 6,
        effects: [{
          type: "np_gain",
          target: "self",
          rawText: "自身のNP獲得量をアップ(3T)",
          value: 50,
          unit: "percent",
          durationTurns: 3,
          probabilistic: false,
          isSpecialAttack: false,
        }],
      },
    ],
  };
}

describe("system attacker skill optimization", () => {
  it("uses a 3-turn damage buff from wave 1 when sorting by total damage", () => {
    const [entry] = buildSystemDamageRanking([baseServant()], PRESET, {
      includeAttackerSkills: true,
      sortBy: "total",
      fou: 0,
      noblePhantasmLevel: 1,
    });

    expect(entry.attackerSkillPlan?.[0]).toContain("attacker-s1");
    expect(entry.waves[0].averageDamage).toBeGreaterThan(0);
    expect(entry.totalAverageDamage).toBeGreaterThan(
      buildSystemDamageRanking([baseServant()], PRESET, {
        includeAttackerSkills: false,
        sortBy: "total",
        fou: 0,
        noblePhantasmLevel: 1,
      })[0].totalAverageDamage,
    );
  });

  it("holds a one-turn NP damage buff for wave 3 when wave 3 is the objective", () => {
    const [entry] = buildSystemDamageRanking([baseServant()], PRESET, {
      includeAttackerSkills: true,
      sortBy: "wave3",
      fou: 0,
      noblePhantasmLevel: 1,
    });

    expect(entry.attackerSkillPlan?.[2]).toContain("attacker-s2");
  });

  it("uses a 3-turn NP-gain buff from wave 1 for total refund", () => {
    const [entry] = buildSystemRefundRanking([baseServant()], PRESET, {
      includeAttackerSkills: true,
      sortBy: "total",
      enemyCountByWave: [3, 3, 3],
      overkillHitsPerEnemy: 0,
    });

    expect(entry.attackerSkillPlan?.[0]).toContain("attacker-s3");
    expect(entry.totalNpPercent).toBeGreaterThan(
      buildSystemRefundRanking([baseServant()], PRESET, {
        includeAttackerSkills: false,
        sortBy: "total",
        enemyCountByWave: [3, 3, 3],
        overkillHitsPerEnemy: 0,
      })[0].totalNpPercent,
    );
  });
});
