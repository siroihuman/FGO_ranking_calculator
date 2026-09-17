import { describe, expect, it } from "vitest";
import { optimizePresetSystem, optimizeThreeWaveSystem } from "../src/system/optimizer.js";
import { buildSystemDamageRanking } from "../src/system/systemDamageRanking.js";
import {
  loadoutInitialNpBonus,
  loadoutPassiveModifiers,
  manaLoadingPercent,
  skillReloadingUses,
} from "../src/system/systemLoadout.js";
import type { SystemPreset } from "../src/system/presets.js";
import type { ServantStatusRecord } from "../src/types/servant.js";

const simplePreset: SystemPreset = {
  id: "test-buster",
  name: "Test Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [],
  defaultActionsByWave: [[], [], []],
};

function damageServant(): ServantStatusRecord {
  return {
    id: "original:test",
    source: "original",
    pageUrl: "https://example.test",
    pageId: "test",
    no: "001",
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
  };
}

describe("system loadout definitions", () => {
  it("matches Mana Loading and Skill Reloading Lv10 values", () => {
    expect(manaLoadingPercent(1)).toBe(10);
    expect(manaLoadingPercent(9)).toBe(18);
    expect(manaLoadingPercent(10)).toBe(20);
    expect(skillReloadingUses(5)).toBe(1);
    expect(skillReloadingUses(6)).toBe(2);
    expect(skillReloadingUses(10)).toBe(3);
    expect(loadoutInitialNpBonus({ append: { manaLoadingLevel: 10 } })).toBe(20);
  });

  it("uses Black Grail Lv100 ATK and NP damage values", () => {
    expect(loadoutPassiveModifiers({ craftEssence: "black-grail" })).toEqual({
      attackBonus: 2400,
      npDamageModPermille: 800,
    });
  });

  it("lets Skill Reloading make a CT3 attacker skill reusable on wave 3", () => {
    const action = {
      id: "attacker-s1",
      label: "Attacker S1",
      owner: "attacker",
      cooldownTurns: 3,
      maxUses: 2,
      npGrant: 50,
      skillReloadingEligible: true,
    } as const;

    const withoutReload = optimizeThreeWaveSystem({
      initialNp: 50,
      refundByWave: [100, 50, 0],
      actions: [action],
    });
    expect(withoutReload.established).toBe(false);

    const withReload = optimizeThreeWaveSystem({
      initialNp: 50,
      refundByWave: [100, 50, 0],
      actions: [action],
      skillReloadingUses: 1,
    });
    expect(withReload.established).toBe(true);
    expect(withReload.actionsByWave?.[0]).toContain("attacker-s1");
    expect(withReload.actionsByWave?.[2]).toContain("attacker-s1");
  });

  it("uses Mage Association NP20 to establish wave 1 when needed", () => {
    const result = optimizePresetSystem(simplePreset, {
      initialNpOverride: 80,
      refundByWave: [100, 100, 0],
      loadout: { mysticCode: "mage-association-uniform" },
    });
    expect(result.established).toBe(true);
    expect(result.actionsByWave?.[0]).toContain("mystic-mage-association-s2");
  });

  it("applies Black Grail to system damage", () => {
    const servant = damageServant();
    const [plain] = buildSystemDamageRanking([servant], simplePreset, {
      fou: 0,
      noblePhantasmLevel: 1,
    });
    const [blackGrail] = buildSystemDamageRanking([servant], simplePreset, {
      fou: 0,
      noblePhantasmLevel: 1,
      loadout: { craftEssence: "black-grail" },
    });
    expect(blackGrail.attack).toBe(12400);
    expect(blackGrail.waves[0].averageDamage).toBeGreaterThan(plain.waves[0].averageDamage);
  });

  it("optimizes Normal Chaldea attack buff timing for the selected wave", () => {
    const [row] = buildSystemDamageRanking([damageServant()], simplePreset, {
      fou: 0,
      noblePhantasmLevel: 1,
      sortBy: "wave3",
      loadout: { mysticCode: "normal-chaldea-uniform" },
    });
    expect(row.attackerSkillPlan?.[2]).toContain("mystic-normal-chaldea-s2");
  });
});
