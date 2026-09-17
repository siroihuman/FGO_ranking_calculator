import { describe, expect, it } from "vitest";
import type { RankingModifierTotals } from "../src/effects/rankingModifiers.js";
import { simulatePresetSystem } from "../src/system/presetSimulator.js";
import {
  BAPHOMET_ARTS_PRESET,
  LUCIFERA_BUSTER_PRESET,
} from "../src/system/presets.js";
import {
  resolveSystemModifiers,
  systemOverchargeStage,
} from "../src/system/supportModifiers.js";

const EMPTY: RankingModifierTotals = {
  attackModPermille: 0,
  defenseModPermille: 0,
  cardPerformanceModPermille: 0,
  cardResistancePermille: 0,
  npDamageModPermille: 0,
  npGainModPermille: 0,
  starGenerationModPermille: 0,
  fixedDamage: 0,
  usesProbabilisticEffect: false,
  appliedEffects: [],
};

describe("system support modifier resolution", () => {
  it("boosts the card-performance UP amount rather than the neutral base", () => {
    const result = resolveSystemModifiers(EMPTY, {
      cardPerformanceModPermille: 1600,
      cardPerformanceBoostPermille: 500,
    });
    expect(result.cardPerformanceModPermille).toBe(2400);
  });

  it("boosts all NP-damage UP already present on the attacker", () => {
    const attacker = { ...EMPTY, npDamageModPermille: 200 };
    const result = resolveSystemModifiers(attacker, {
      npDamageModPermille: 300,
      npDamageBoostPermille: 1000,
    });
    expect(result.npDamageModPermille).toBe(1000);
  });

  it("clamps support OC increase to OC5", () => {
    expect(systemOverchargeStage(1, { overchargeStageIncrease: 4 })).toBe(5);
    expect(systemOverchargeStage(3, { overchargeStageIncrease: 4 })).toBe(5);
  });
});

describe("system preset NP behavior", () => {
  it("applies Baphomet recurring NP after each Noble Phantasm", () => {
    const result = simulatePresetSystem(BAPHOMET_ARTS_PRESET, {
      refundByWave: [90, 90, 0],
      actionsByWave: [[], [], []],
    });
    expect(result.established).toBe(true);
    expect(result.waves[0].npAtWaveEnd).toBe(100);
    expect(result.waves[1].npAtWaveStart).toBe(100);
  });

  it("doubles the current gauge after Lucifera S2 adds 50% NP", () => {
    const result = simulatePresetSystem(LUCIFERA_BUSTER_PRESET, {
      refundByWave: [25, 25, 0],
      actionsByWave: [
        [],
        ["lucifera-a-s2", "lucifera-a-s3"],
        ["lucifera-b-s2", "lucifera-b-s3"],
      ],
    });
    expect(result.established).toBe(true);
    expect(result.waves[1].npAtWaveStart).toBe(25);
    expect(result.waves[1].actionUses[0].npAfter).toBe(75);
    expect(result.waves[1].actionUses[1].npAfter).toBe(150);
  });
});
