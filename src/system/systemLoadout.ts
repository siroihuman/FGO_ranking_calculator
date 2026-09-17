import type { NormalizedRankingEffect } from "../effects/types.js";
import type { SystemActionDefinition } from "./actionSimulator.js";

export type SystemCraftEssenceId = "none" | "black-grail";
export type SystemMysticCodeId =
  | "none"
  | "normal-chaldea-uniform"
  | "atlas-academy-uniform"
  | "mage-association-uniform";

export type AppendSkillLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface SystemAppendConfiguration {
  manaLoadingLevel?: AppendSkillLevel;
  skillReloadingLevel?: AppendSkillLevel;
}

export interface SystemLoadout {
  craftEssence?: SystemCraftEssenceId;
  mysticCode?: SystemMysticCodeId;
  append?: SystemAppendConfiguration;
}

export interface SystemLoadoutPassiveModifiers {
  attackBonus: number;
  npDamageModPermille: number;
}

export interface SystemExternalTimelineAction {
  action: SystemActionDefinition;
  effects?: readonly NormalizedRankingEffect[];
}

const MANA_LOADING_PERCENT = [0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20] as const;

export function manaLoadingPercent(level: AppendSkillLevel | undefined): number {
  return MANA_LOADING_PERCENT[level ?? 0];
}

/**
 * Skill Reloading grants one post-use cooldown advance to a limited number of
 * distinct servant skills. Lv1-5: one skill, Lv6-9: two skills, Lv10: three.
 * Each servant skill can receive this append effect only once.
 */
export function skillReloadingUses(level: AppendSkillLevel | undefined): number {
  const resolved = level ?? 0;
  if (resolved <= 0) return 0;
  if (resolved <= 5) return 1;
  if (resolved <= 9) return 2;
  return 3;
}

export function loadoutInitialNpBonus(loadout: SystemLoadout | undefined): number {
  return manaLoadingPercent(loadout?.append?.manaLoadingLevel);
}

export function loadoutPassiveModifiers(
  loadout: SystemLoadout | undefined,
): SystemLoadoutPassiveModifiers {
  if (loadout?.craftEssence === "black-grail") {
    return {
      attackBonus: 2400,
      npDamageModPermille: 800,
    };
  }
  return {
    attackBonus: 0,
    npDamageModPermille: 0,
  };
}

function attackBuff40(): NormalizedRankingEffect {
  return {
    type: "attack",
    target: "self",
    rawText: "ノーマルカルデア制服：味方単体の攻撃力を40%アップ(1T)",
    value: 40,
    unit: "percent",
    durationTurns: 1,
    probabilistic: false,
    isSpecialAttack: false,
  };
}

/**
 * Only effects relevant to system damage / NP-loop calculations are exposed.
 * Order Change is intentionally not generated here; it must be enabled by a
 * dedicated system preset rather than invented by the optimizer.
 */
export function mysticCodeTimelineAction(
  mysticCode: SystemMysticCodeId | undefined,
): SystemExternalTimelineAction | undefined {
  switch (mysticCode ?? "none") {
    case "normal-chaldea-uniform":
      return {
        action: {
          id: "mystic-normal-chaldea-s2",
          label: "ノーマルカルデア制服 S2：魔力強化",
          owner: "mysticCode",
          maxUses: 1,
          allowedWaves: [1, 2, 3],
          npGrant: 10,
        },
        effects: [attackBuff40()],
      };
    case "atlas-academy-uniform":
      return {
        action: {
          id: "mystic-atlas-s3",
          label: "アトラス院制服 S3：メジェドの眼",
          owner: "mysticCode",
          maxUses: 1,
          allowedWaves: [1, 2, 3],
          cooldownReduction: { targetOwner: "attacker", turns: 2 },
        },
      };
    case "mage-association-uniform":
      return {
        action: {
          id: "mystic-mage-association-s2",
          label: "魔術協会制服 S2：霊子譲渡",
          owner: "mysticCode",
          maxUses: 1,
          allowedWaves: [1, 2, 3],
          npGrant: 20,
        },
      };
    default:
      return undefined;
  }
}

export function loadoutSkillReloadingUses(loadout: SystemLoadout | undefined): number {
  return skillReloadingUses(loadout?.append?.skillReloadingLevel);
}
