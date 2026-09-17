import { describe, expect, it } from "vitest";
import { optimizePresetSystem, optimizeThreeWaveSystem } from "../src/system/optimizer.js";
import { SUMMER_SKADI_QUICK_PRESET } from "../src/system/presets.js";

describe("system optimizer", () => {
  it("automatically finds the 50% refund + 50% support charge Quick loop", () => {
    const result = optimizePresetSystem(SUMMER_SKADI_QUICK_PRESET, {
      refundByWave: [50, 50, 0],
    });

    expect(result.established).toBe(true);
    expect(result.actionsByWave).toEqual([
      [],
      ["summer-skadi-a-np50"],
      ["summer-skadi-b-np50"],
    ]);
  });

  it("combines support NP with a reusable attacker NP skill when refund is below 50%", () => {
    const result = optimizePresetSystem(SUMMER_SKADI_QUICK_PRESET, {
      refundByWave: [30, 30, 0],
      attackerActions: [{
        id: "attacker-s1",
        label: "自身S1",
        owner: "attacker",
        cooldownTurns: 1,
        maxUses: 2,
        npGrant: 20,
      }],
    });

    expect(result.established).toBe(true);
    expect(result.actionsByWave?.[1]).toContain("attacker-s1");
    expect(result.actionsByWave?.[2]).toContain("attacker-s1");
    expect(result.simulation?.waves[1].npBeforeNoblePhantasm).toBe(100);
    expect(result.simulation?.waves[2].npBeforeNoblePhantasm).toBe(100);
  });

  it("prefers an unconditional action over an equivalent conditional action", () => {
    const result = optimizeThreeWaveSystem({
      initialNp: 100,
      refundByWave: [50, 50, 0],
      actions: [
        {
          id: "normal-charge",
          label: "通常NP50",
          owner: "attacker",
          maxUses: 2,
          npGrant: 50,
          allowedWaves: [2, 3],
        },
        {
          id: "conditional-charge",
          label: "条件付きNP50",
          owner: "attacker",
          maxUses: 2,
          npGrant: 50,
          allowedWaves: [2, 3],
          conditional: true,
        },
      ],
    });

    expect(result.established).toBe(true);
    expect(result.actionsByWave).toEqual([
      [],
      ["normal-charge"],
      ["normal-charge"],
    ]);
  });
});
