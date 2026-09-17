import { describe, expect, it } from "vitest";
import type { NormalizedRankingEffect } from "../src/effects/types.js";
import { enumerateAttackerSkillTimelines } from "../src/system/attackerSkillTimeline.js";
import {
  DOUBLE_KOYANSKAYA_BUSTER_PRESET,
  type SystemPreset,
} from "../src/system/presets.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

const EMPTY_BUSTER_PRESET: SystemPreset = {
  id: "empty-buster",
  name: "Empty Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [],
  defaultActionsByWave: [[], [], []],
};

function effect(overrides: Partial<NormalizedRankingEffect>): NormalizedRankingEffect {
  return {
    type: "attack",
    target: "self",
    rawText: "test",
    value: 50,
    unit: "percent",
    probabilistic: false,
    isSpecialAttack: false,
    ...overrides,
  };
}

function servantWithSkill(
  effects: NormalizedRankingEffect[],
  ct = 6,
): ServantStatusRecord {
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
      effectRows: [],
    },
    skills: [{
      slot: 1,
      name: "Test Skill",
      strengthened: false,
      ct,
      effects,
    }],
  };
}

describe("attacker skill timelines", () => {
  it("keeps a 3-turn self buff active across all three waves", () => {
    const servant = servantWithSkill([effect({ durationTurns: 3 })]);
    const timelines = enumerateAttackerSkillTimelines(servant, EMPTY_BUSTER_PRESET, {
      cardType: "buster",
    });
    const wave1Use = timelines.find((timeline) =>
      timeline.waves[0].usedSkillIds.includes("attacker-s1")
      && timeline.skillUses === 1,
    );

    expect(wave1Use).toBeDefined();
    expect(wave1Use!.waves.map((wave) => wave.modifiers.attackModPermille))
      .toEqual([500, 500, 500]);
  });

  it("consumes a 1-use 3-turn NP buff after the first NP", () => {
    const servant = servantWithSkill([effect({
      type: "noble_phantasm_damage",
      durationTurns: 3,
      remainingUses: 1,
    })]);
    const timelines = enumerateAttackerSkillTimelines(servant, EMPTY_BUSTER_PRESET, {
      cardType: "buster",
    });
    const wave1Use = timelines.find((timeline) =>
      timeline.waves[0].usedSkillIds.includes("attacker-s1")
      && timeline.skillUses === 1,
    );

    expect(wave1Use).toBeDefined();
    expect(wave1Use!.waves.map((wave) => wave.modifiers.npDamageModPermille))
      .toEqual([500, 0, 0]);
  });

  it("does not carry enemy debuffs into the next wave", () => {
    const servant = servantWithSkill([effect({
      type: "defense",
      target: "all_enemies",
      value: -30,
      durationTurns: 3,
    })]);
    const timelines = enumerateAttackerSkillTimelines(servant, EMPTY_BUSTER_PRESET, {
      cardType: "buster",
    });
    const wave1Use = timelines.find((timeline) =>
      timeline.waves[0].usedSkillIds.includes("attacker-s1")
      && timeline.skillUses === 1,
    );

    expect(wave1Use).toBeDefined();
    expect(wave1Use!.waves.map((wave) => wave.modifiers.defenseModPermille))
      .toEqual([-300, 0, 0]);
  });

  it("allows an attacker skill to be reused after Koyanskaya cooldown reductions", () => {
    const servant = servantWithSkill([effect({ durationTurns: 1 })], 5);
    const timelines = enumerateAttackerSkillTimelines(
      servant,
      DOUBLE_KOYANSKAYA_BUSTER_PRESET,
      { cardType: "buster" },
    );
    const reused = timelines.find((timeline) =>
      timeline.waves[0].usedSkillIds.includes("attacker-s1")
      && timeline.waves[2].usedSkillIds.includes("attacker-s1"),
    );

    expect(reused).toBeDefined();
  });
});
