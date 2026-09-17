import {
  activeRankingEffects,
  resolveEffectModifierTotals,
  type OverchargeStage,
  type RankingModifierTotals,
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
  type ResolvedSystemModifiers,
} from "./supportModifiers.js";
import {
  enumerateAttackerSkillTimelines,
  type AttackerSkillTimeline,
} from "./attackerSkillTimeline.js";
import {
  loadoutPassiveModifiers,
  type SystemLoadout,
} from "./systemLoadout.js";

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
  loadout?: SystemLoadout;
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
  attackerSkillPlan?: readonly [readonly string[], readonly string[], readonly string[]];
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

function modifierTotalsForWave(
  servant: ServantStatusRecord,
  cardType: CommandCardType,
  oc: OverchargeStage,
  conditionalEffects: boolean,
  timeline: AttackerSkillTimeline | undefined,
  waveIndex: number,
): RankingModifierTotals {
  const baseEffects = activeRankingEffects(servant, {
    includeSkills: false,
    includeConditionalEffects: conditionalEffects,
    cardType,
    noblePhantasm: true,
    overchargeStage: oc,
    includeNoblePhantasmPreAttackEffects: true,
  });
  const timedEffects = timeline?.waves[waveIndex].activeEffects ?? [];
  return resolveEffectModifierTotals([...baseEffects, ...timedEffects], {
    includeConditionalEffects: conditionalEffects,
    cardType,
    noblePhantasm: true,
  });
}

function withLoadoutNpDamage(
  modifiers: ResolvedSystemModifiers,
  loadout: SystemLoadout | undefined,
): ResolvedSystemModifiers {
  const passive = loadoutPassiveModifiers(loadout);
  return {
    ...modifiers,
    npDamageModPermille: modifiers.npDamageModPermille + passive.npDamageModPermille,
  };
}

function oneDamage(
  servant: ServantStatusRecord,
  attack: number,
  multiplier: number,
  modifiers: ResolvedSystemModifiers,
  randomModifierPermille: number,
): number {
  const np = servant.noblePhantasm!;
  return calculateDamage({
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
    randomModifierPermille,
    attackModPermille: modifiers.attackModPermille,
    defenseModPermille: modifiers.defenseModPermille,
    npDamageModPermille: modifiers.npDamageModPermille,
    fixedDamage: modifiers.fixedDamage,
    extraCardModifierPermille: 1000,
    npSpecialAttackPermille: 1000,
  }).damage;
}

function proxyTimelineScore(
  servant: ServantStatusRecord,
  preset: SystemPreset,
  attack: number,
  multiplier: number,
  baseOc: OverchargeStage,
  conditionalEffects: boolean,
  sortBy: SystemDamageSort,
  timeline: AttackerSkillTimeline | undefined,
  loadout: SystemLoadout | undefined,
): number {
  const waveValues = [0, 1, 2].map((waveIndex) => {
    const support = preset.supportModifiersByWave?.[waveIndex];
    const oc = systemOverchargeStage(baseOc, support);
    const attacker = modifierTotalsForWave(
      servant,
      preset.cardType,
      oc,
      conditionalEffects,
      timeline,
      waveIndex,
    );
    return oneDamage(
      servant,
      attack,
      multiplier,
      withLoadoutNpDamage(resolveSystemModifiers(attacker, support), loadout),
      1000,
    );
  });
  if (sortBy === "wave1") return waveValues[0];
  if (sortBy === "wave2") return waveValues[1];
  if (sortBy === "wave3") return waveValues[2];
  return waveValues.reduce((sum, value) => sum + value, 0);
}

function betterTimeline(
  left: AttackerSkillTimeline | undefined,
  right: AttackerSkillTimeline,
  leftScore: number,
  rightScore: number,
): boolean {
  if (!left) return true;
  if (rightScore !== leftScore) return rightScore > leftScore;
  if (right.skillUses !== left.skillUses) return right.skillUses < left.skillUses;
  if (right.usesConditionalEffect !== left.usesConditionalEffect) {
    return !right.usesConditionalEffect;
  }
  if (right.usesProbabilisticEffect !== left.usesProbabilisticEffect) {
    return !right.usesProbabilisticEffect;
  }
  return JSON.stringify(right.actionsByWave).localeCompare(JSON.stringify(left.actionsByWave)) < 0;
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
  const conditionalEffects = options.conditionalEffects ?? false;
  const loadoutPassive = loadoutPassiveModifiers(options.loadout);

  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const np = servant.noblePhantasm;
    if (!np || np.targetScope === "support" || np.cardType !== preset.cardType) return [];
    const baseAttack = attackAtLevel(servant, statusLevel);
    if (baseAttack === null) return [];
    const npLevel = resolvedNpLevel(servant, npLevelOption, welfare);
    const multiplier = np.damageMultiplierPermilleByLevel?.[npLevel - 1];
    if (multiplier === undefined) return [];
    const attack = baseAttack + fou + loadoutPassive.attackBonus;

    let selectedTimeline: AttackerSkillTimeline | undefined;
    const needsTimeline = Boolean(options.includeAttackerSkills)
      || (options.loadout?.mysticCode !== undefined && options.loadout.mysticCode !== "none");
    if (needsTimeline) {
      let selectedScore = Number.NEGATIVE_INFINITY;
      for (const timeline of enumerateAttackerSkillTimelines(servant, preset, {
        cardType: preset.cardType,
        conditionalEffects,
        includeAttackerSkills: options.includeAttackerSkills ?? false,
        loadout: options.loadout,
      })) {
        const score = proxyTimelineScore(
          servant,
          preset,
          attack,
          multiplier,
          baseOc,
          conditionalEffects,
          sortBy,
          timeline,
          options.loadout,
        );
        if (betterTimeline(selectedTimeline, timeline, selectedScore, score)) {
          selectedTimeline = timeline;
          selectedScore = score;
        }
      }
    }

    let usesProbabilisticEffect = selectedTimeline?.usesProbabilisticEffect ?? false;
    const waves = [0, 1, 2].map((waveIndex) => {
      const support = preset.supportModifiersByWave?.[waveIndex];
      const oc = systemOverchargeStage(baseOc, support);
      const attackerModifiers = modifierTotalsForWave(
        servant,
        np.cardType,
        oc,
        conditionalEffects,
        selectedTimeline,
        waveIndex,
      );
      usesProbabilisticEffect ||= attackerModifiers.usesProbabilisticEffect;
      const modifiers = withLoadoutNpDamage(
        resolveSystemModifiers(attackerModifiers, support),
        options.loadout,
      );
      const damages: number[] = [];
      for (let random = 900; random <= 1099; random += 1) {
        damages.push(oneDamage(servant, attack, multiplier, modifiers, random));
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
      ...(selectedTimeline ? { attackerSkillPlan: selectedTimeline.actionsByWave } : {}),
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