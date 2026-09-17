import { describe, expect, it } from "vitest";
import { simulateSystemActionPlan } from "../src/system/actionSimulator.js";
import { simulatePresetSystem } from "../src/system/presetSimulator.js";
import { SUMMER_SKADI_QUICK_PRESET } from "../src/system/presets.js";

describe("system action simulation", () => {
  it("establishes the canonical Quick loop with 50% refund + 50% grant", () => {
    const result = simulatePresetSystem(SUMMER_SKADI_QUICK_PRESET, {
      refundByWave: [50, 50, 0],
    });

    expect(result.established).toBe(true);
    expect(result.waves[1].npAtWaveStart).toBe(50);
    expect(result.waves[1].npBeforeNoblePhantasm).toBe(100);
    expect(result.waves[2].npBeforeNoblePhantasm).toBe(100);
  });

  it("does not treat 49% refund + 50% grant as established", () => {
    const result = simulatePresetSystem(SUMMER_SKADI_QUICK_PRESET, {
      refundByWave: [49, 50, 0],
    });

    expect(result.established).toBe(false);
    expect(result.failedWave).toBe(2);
    expect(result.waves[1].npBeforeNoblePhantasm).toBe(99);
    expect(result.waves[1].shortage).toBe(1);
  });

  it("resolves cooldown reduction in the listed action order", () => {
    const actions = [
      {
        id: "attacker-s1",
        label: "Attacker S1",
        owner: "attacker",
        cooldownTurns: 3,
        npGrant: 0,
      },
      {
        id: "support-reduce",
        label: "Support cooldown reduction",
        owner: "supportA",
        maxUses: 1,
        cooldownReduction: { targetOwner: "attacker", turns: 2 },
      },
    ];

    const result = simulateSystemActionPlan({
      initialNp: 100,
      refundByWave: [100, 100, 0],
      actions,
      actionsByWave: [
        ["attacker-s1"],
        ["support-reduce", "attacker-s1"],
        [],
      ],
    });

    expect(result.invalidActions).toHaveLength(0);
    expect(result.waves[1].actionUses[1].valid).toBe(true);
  });

  it("rejects a skill used before its cooldown has been reduced", () => {
    const result = simulateSystemActionPlan({
      initialNp: 100,
      refundByWave: [100, 100, 0],
      actions: [
        {
          id: "attacker-s1",
          label: "Attacker S1",
          owner: "attacker",
          cooldownTurns: 3,
        },
        {
          id: "support-reduce",
          label: "Support cooldown reduction",
          owner: "supportA",
          maxUses: 1,
          cooldownReduction: { targetOwner: "attacker", turns: 2 },
        },
      ],
      actionsByWave: [
        ["attacker-s1"],
        ["attacker-s1", "support-reduce"],
        [],
      ],
    });

    expect(result.established).toBe(false);
    expect(result.invalidActions).toHaveLength(1);
    expect(result.invalidActions[0].reason).toContain("cooldown remaining");
  });
});
