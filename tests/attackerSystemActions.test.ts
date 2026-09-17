import { describe, expect, it } from "vitest";
import { buildAttackerNpChargeActions } from "../src/system/attackerActions.js";
import type { NormalizedRankingEffect, ServantSkillData } from "../src/effects/types.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

function chargeEffect(value: number, conditionText?: string): NormalizedRankingEffect {
  return {
    type: "np_charge",
    target: "self",
    rawText: `自身のNPを${value}%増やす`,
    value,
    unit: "np_percent",
    probabilistic: false,
    ...(conditionText ? { conditionText } : {}),
    isSpecialAttack: false,
  };
}

function skill(
  slot: 1 | 2 | 3,
  name: string,
  value: number,
  strengthened: boolean,
  ct: number,
  conditionText?: string,
): ServantSkillData {
  return {
    slot,
    name,
    strengthened,
    ct,
    effects: [chargeEffect(value, conditionText)],
  };
}

const servant: ServantStatusRecord = {
  id: "original:test",
  source: "original",
  pageUrl: "https://example.invalid/test",
  pageId: "test",
  no: "999",
  name: "テスト",
  className: "Caster",
  rarity: 5,
  status: { maxLevel: 90, hpMax: 10000, atkMax: 10000 },
  skills: [
    skill(1, "旧S1", 30, false, 7),
    skill(1, "強化S1", 50, true, 6),
    skill(2, "条件付きS2", 20, false, 6, "HP50%以下の時"),
    {
      slot: 3,
      name: "対象選択S3",
      strengthened: false,
      ct: 5,
      effects: [{ ...chargeEffect(20), target: "ally_single" }],
    },
  ],
};

describe("buildAttackerNpChargeActions", () => {
  it("prefers strengthened skills and excludes conditional charge by default", () => {
    const actions = buildAttackerNpChargeActions(servant);

    expect(actions.map((action) => [action.id, action.npGrant])).toEqual([
      ["attacker-s1", 50],
      ["attacker-s3", 20],
    ]);
    expect(actions[0].cooldownTurns).toBe(6);
  });

  it("includes conditional NP charge when conditional effects are enabled", () => {
    const actions = buildAttackerNpChargeActions(servant, {
      includeConditionalEffects: true,
    });

    expect(actions.map((action) => action.id)).toEqual([
      "attacker-s1",
      "attacker-s2",
      "attacker-s3",
    ]);
    expect(actions[1].conditional).toBe(true);
  });
});
