import {
  resolveRankingModifierTotals,
  type OverchargeStage,
} from "../effects/rankingModifiers.js";
import { calculateDamage } from "../formulas/damage.js";
import type {
  CommandCardType,
  ServantClass,
  ServantSource,
  ServantStatusRecord,
} from "../types/servant.js";
import type { FouBonus, StatusLevel } from "../ranking/statusRanking.js";
import type { NoblePhantasmLevel } from "../ranking/noblePhantasmDamageRanking.js";
import type { SystemPreset } from "./presets.js";
import {
  resolveSystemModifiers,
  systemOverchargeStage,
} from "./supportModifiers.js";

const NP_CARD_DAMAGE_VALUE_PERMILLE: Record<CommandCardType, number> = {
  buster: 1500,
  arts: 1000,
  quick: 800,
};

const CLASS_ATTACK_COEFFICIENT_PERMILLE: Record<ServantClass, number> = {
  Saber: 1000,
  Archer: 950,
  Lancer: 1050,
  Rider: 1000,
  Caster: 900,
  Assassin: 900,
  Berserker: 1100,
  Ruler: 1000,
  Avenger: 1100,
  MoonCancer: 1000,
  AlterEgo: 1000,
  Foreigner: 1000,
  Pretender: 1000,
  Shielder: 1000,
  Beast: 1000,
  Other: 1000,
};

export type SystemDamageSort = "wave1" | "wave2" | "wave3" | "total";
export type SystemNoblePhantasmLevel = NoblePhantasmLevel | "legacy";

export interface SystemDamageRankingOptions {
  source?: ServantSource | "all";
  level?: StatusLevel;
  fou?: FouBonus;
  noblePhantasmLevel?: SystemNoblePhantasmLevel;
  /** Page IDs identified as welfare servants use NP5 under legacy rules. */
  welfarePageIds?: readonly string[];
  includeAttackerSkills?: boolean;
  conditionalEffects?: boolean;
  overchargeStage?: OverchargeStage;
  sortBy?: SystemDamageSort;
}

export interface SystemDamageWaveResult {
  wave: 1 | 2 | 3;
  minimumDamage: number;
  averageDamage: number;
  maximumDamage: number;
  overchargeStage: OverchargeStage;
}

export interface SystemDamageRankingEntry {
  rank: number;
  servant: ServantStatusRecord;
  noblePhantasmLevel: NoblePhantasmLevel;
  attack: number;
  waves: readonly [SystemDamageWaveResult, SystemDamageWaveResult, SystemDamageWaveResult];
  totalAverageDamage: number;
  usesProbabilisticEffect: boolean;
}

function attackAtLevel(servant: ServantStatusRecord, level: StatusLevel): number | null {
  if (level === "max") return servant.status.atkMax;
  if (level === 100) return servant.status.atk100 ?? null;
  return servant.status.atk120 ?? null;
}

function resolvedNpLevel(
  servant: ServantStatusRecord,
  level: SystemNoblePhantasmLevel,
  welfarePageIds: readonly string[],
): NoblePhantasmLevel {
  if (level !== "legacy") return level;
  if (welfarePageIds.includes(servant.pageId)) return 5;
  return servant.rarity <= 3 ? 5 : 2;
}

function sortValue(
  entry: Omit<SystemDamageRankingEntry, "rank">,
  sortBy: SystemDamageSort,
): number {
  if (sortBy === "wave1") return entry.waves[0].averageDamage;
  if (sortBy === "wave2") return entry.waves[1].averageDamage;
  if (sortBy === "wave3") return entry.waves[2].averageDamage;
  return entry.totalAverageDamage;
}

export function buildSystemDamageRanking(
  servants: readonly ServantStatusRecord[],
  preset: SystemPreset,
  options: SystemDamageRankingOptions = {},
): SystemDamageRankingEntry[] {
  const source = options.source ?? "all";
  const statusLevel = options.level ?? "max";
  const fou = options.fou ?? 1000;
  const npLevelOption = options.noblePhantasmLevel ?? "legacy";
  const welfare = options.welfarePageIds ?? [];
  const baseOc = options.overchargeStage ?? 1;
  const sortBy = options.sortBy ?? "total";

  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const np = servant.noblePhantasm;
    if (!np || np.targetScope === "support" || np.cardType !== preset.cardType) return [];
    const baseAttack = attackAtLevel(servant, statusLevel);
    if (baseAttack === null) return [];
    const npLevel = resolvedNpLevel(servant, npLevelOption, welfare);
    const multiplier = np.damageMultiplierPermilleByLevel?.[npLevel - 1];
    if (multiplier === undefined) return [];
    const attack = baseAttack + fou;
    let usesProbabilisticEffect = false;

    const waves = [0, 1, 2].map((waveIndex) => {
      const support = preset.supportModifiersByWave?.[waveIndex];
      const oc = systemOverchargeStage(baseOc, support);
      const attackerModifiers = resolveRankingModifierTotals(servant, {
        includeSkills: options.includeAttackerSkills ?? false,
        includeConditionalEffects: options.conditionalEffects ?? false,
        cardType: np.cardType,
        noblePhantasm: true,
        overchargeStage: oc,
        includeNoblePhantasmPreAttackEffects: true,
      });
      usesProbabilisticEffect ||= attackerModifiers.usesProbabilisticEffect;
      const modifiers = resolveSystemModifiers(attackerModifiers, support);
      const damages: number[] = [];
      for (let random = 900; random <= 1099; random += 1) {
        damages.push(calculateDamage({
          attack,
          isNoblePhantasm: true,
          npDamageMultiplierPermille: multiplier,
          cardDamageValuePermille: NP_CARD_DAMAGE_VALUE_PERMILLE[np.cardType],
          cardPerformanceModPermille: modifiers.cardPerformanceModPermille,
          cardResistancePermille: modifiers.cardResistancePermille,
          firstCardBonusPermille: 0,
          classAttackCoefficientPermille: CLASS_ATTACK_COEFFICIENT_PERMILLE[servant.className],
          classAffinityPermille: 1000,
          attributeAffinityPermille: 1000,
          randomModifierPermille: random,
          attackModPermille: modifiers.attackModPermille,
          defenseModPermille: modifiers.defenseModPermille,
          npDamageModPermille: modifiers.npDamageModPermille,
          fixedDamage: modifiers.fixedDamage,
          extraCardModifierPermille: 1000,
          npSpecialAttackPermille: 1000,
        }).damage);
      }
      const total = damages.reduce((sum, value) => sum + value, 0);
      return {
        wave: (waveIndex + 1) as 1 | 2 | 3,
        minimumDamage: damages[0],
        averageDamage: total / damages.length,
        maximumDamage: damages[damages.length - 1],
        overchargeStage: oc,
      };
    }) as unknown as [SystemDamageWaveResult, SystemDamageWaveResult, SystemDamageWaveResult];

    return [{
      servant,
      noblePhantasmLevel: npLevel,
      attack,
      waves,
      totalAverageDamage: waves.reduce((sum, wave) => sum + wave.averageDamage, 0),
      usesProbabilisticEffect,
    }];
  });

  rows.sort((left, right) =>
    sortValue(right, sortBy) - sortValue(left, sortBy)
    || left.servant.name.localeCompare(right.servant.name, "ja"),
  );

  let previousValue: number | undefined;
  let previousRank = 0;
  return rows.map((row, index) => {
    const value = sortValue(row, sortBy);
    const rank = value === previousValue ? previousRank : index + 1;
    previousValue = value;
    previousRank = rank;
    return { ...row, rank };
  });
}
