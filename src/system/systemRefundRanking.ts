import {
  activeRankingEffects,
  resolveEffectModifierTotals,
  type OverchargeStage,
  type RankingModifierTotals,
} from "../effects/rankingModifiers.js";
import { calculateNoblePhantasmNp } from "../formulas/noblePhantasmNp.js";
import { npUnitsToPercent } from "../formulas/cardNp.js";
import type { CommandCardType, ServantSource, ServantStatusRecord } from "../types/servant.js";
import type { SystemPreset } from "./presets.js";
import {
  resolveSystemModifiers,
  systemOverchargeStage,
} from "./supportModifiers.js";
import {
  enumerateAttackerSkillTimelines,
  type AttackerSkillTimeline,
} from "./attackerSkillTimeline.js";

export type SystemRefundSort = "wave1" | "wave2" | "wave3" | "total";

export interface SystemRefundRankingOptions {
  source?: ServantSource | "all";
  targetNpRatePermille?: number;
  enemyCountByWave?: readonly [number, number, number];
  /** Undefined uses ceil(Hit / 2), matching the legacy ranking's OK-Hit convention. */
  overkillHitsPerEnemy?: number;
  includeAttackerSkills?: boolean;
  conditionalEffects?: boolean;
  overchargeStage?: OverchargeStage;
  sortBy?: SystemRefundSort;
}

export interface SystemRefundWaveResult {
  wave: 1 | 2 | 3;
  npUnits: number;
  npPercent: number;
  enemyCount: number;
  overkillHitsPerEnemy: number;
}

export interface SystemRefundRankingEntry {
  rank: number;
  servant: ServantStatusRecord;
  waves: readonly [SystemRefundWaveResult, SystemRefundWaveResult, SystemRefundWaveResult];
  totalNpPercent: number;
  usesProbabilisticEffect: boolean;
  attackerSkillPlan?: readonly [readonly string[], readonly string[], readonly string[]];
}

function waveValue(entry: Omit<SystemRefundRankingEntry, "rank">, sortBy: SystemRefundSort): number {
  if (sortBy === "wave1") return entry.waves[0].npUnits;
  if (sortBy === "wave2") return entry.waves[1].npUnits;
  if (sortBy === "wave3") return entry.waves[2].npUnits;
  return entry.waves.reduce((sum, wave) => sum + wave.npUnits, 0);
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

function timelineRefundUnits(
  servant: ServantStatusRecord,
  preset: SystemPreset,
  timeline: AttackerSkillTimeline | undefined,
  options: Required<Pick<SystemRefundRankingOptions, "targetNpRatePermille" | "sortBy">> & {
    enemyCountByWave?: readonly [number, number, number];
    overkillHitsPerEnemy?: number;
    conditionalEffects: boolean;
    baseOc: OverchargeStage;
  },
): [number, number, number] {
  const np = servant.noblePhantasm!;
  const npGainRate = servant.hidden!.npGainRate!;
  const hitCount = np.hitCount ?? servant.hidden!.noblePhantasmHits!;
  return [0, 1, 2].map((waveIndex) => {
    const support = preset.supportModifiersByWave?.[waveIndex];
    const oc = systemOverchargeStage(options.baseOc, support);
    const attacker = modifierTotalsForWave(
      servant,
      np.cardType,
      oc,
      options.conditionalEffects,
      timeline,
      waveIndex,
    );
    const modifiers = resolveSystemModifiers(attacker, support);
    const enemyCount = options.enemyCountByWave?.[waveIndex]
      ?? (np.targetScope === "all" ? 3 : 1);
    const overkillHits = options.overkillHitsPerEnemy ?? Math.ceil(hitCount / 2);
    return calculateNoblePhantasmNp({
      npGainRate,
      cardType: np.cardType,
      hits: hitCount,
      enemyCount,
      targetNpRatePermille: options.targetNpRatePermille,
      overkillHitsPerEnemy: overkillHits,
      cardPerformanceModPermille: modifiers.cardPerformanceModPermille,
      cardResistancePermille: modifiers.cardResistancePermille,
      npGainModPermille: modifiers.npGainModPermille,
    });
  }) as [number, number, number];
}

function timelineScore(units: readonly [number, number, number], sortBy: SystemRefundSort): number {
  if (sortBy === "wave1") return units[0];
  if (sortBy === "wave2") return units[1];
  if (sortBy === "wave3") return units[2];
  return units[0] + units[1] + units[2];
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
  if (right.usesConditionalEffect !== left.usesConditionalEffect) return !right.usesConditionalEffect;
  if (right.usesProbabilisticEffect !== left.usesProbabilisticEffect) return !right.usesProbabilisticEffect;
  return JSON.stringify(right.actionsByWave).localeCompare(JSON.stringify(left.actionsByWave)) < 0;
}

export function buildSystemRefundRanking(
  servants: readonly ServantStatusRecord[],
  preset: SystemPreset,
  options: SystemRefundRankingOptions = {},
): SystemRefundRankingEntry[] {
  const source = options.source ?? "all";
  const baseOc = options.overchargeStage ?? 1;
  const targetNpRate = options.targetNpRatePermille ?? 1000;
  const sortBy = options.sortBy ?? "total";
  const conditionalEffects = options.conditionalEffects ?? false;

  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const np = servant.noblePhantasm;
    const npGainRate = servant.hidden?.npGainRate;
    const hitCount = np?.hitCount ?? servant.hidden?.noblePhantasmHits;
    if (!np || np.targetScope === "support" || np.cardType !== preset.cardType) return [];
    if (npGainRate === undefined || hitCount === undefined) return [];

    let selectedTimeline: AttackerSkillTimeline | undefined;
    let selectedUnits: [number, number, number] | undefined;
    if (options.includeAttackerSkills) {
      let selectedScore = Number.NEGATIVE_INFINITY;
      for (const timeline of enumerateAttackerSkillTimelines(servant, preset, {
        cardType: preset.cardType,
        conditionalEffects,
      })) {
        const units = timelineRefundUnits(servant, preset, timeline, {
          targetNpRatePermille: targetNpRate,
          sortBy,
          ...(options.enemyCountByWave ? { enemyCountByWave: options.enemyCountByWave } : {}),
          ...(options.overkillHitsPerEnemy !== undefined
            ? { overkillHitsPerEnemy: options.overkillHitsPerEnemy }
            : {}),
          conditionalEffects,
          baseOc,
        });
        const score = timelineScore(units, sortBy);
        if (betterTimeline(selectedTimeline, timeline, selectedScore, score)) {
          selectedTimeline = timeline;
          selectedUnits = units;
          selectedScore = score;
        }
      }
    }

    let usesProbabilisticEffect = selectedTimeline?.usesProbabilisticEffect ?? false;
    const computedUnits = selectedUnits ?? timelineRefundUnits(servant, preset, undefined, {
      targetNpRatePermille: targetNpRate,
      sortBy,
      ...(options.enemyCountByWave ? { enemyCountByWave: options.enemyCountByWave } : {}),
      ...(options.overkillHitsPerEnemy !== undefined
        ? { overkillHitsPerEnemy: options.overkillHitsPerEnemy }
        : {}),
      conditionalEffects,
      baseOc,
    });

    const waves = [0, 1, 2].map((waveIndex) => {
      const support = preset.supportModifiersByWave?.[waveIndex];
      const oc = systemOverchargeStage(baseOc, support);
      const attacker = modifierTotalsForWave(
        servant,
        np.cardType,
        oc,
        conditionalEffects,
        selectedTimeline,
        waveIndex,
      );
      usesProbabilisticEffect ||= attacker.usesProbabilisticEffect;
      const enemyCount = options.enemyCountByWave?.[waveIndex]
        ?? (np.targetScope === "all" ? 3 : 1);
      const overkillHits = options.overkillHitsPerEnemy ?? Math.ceil(hitCount / 2);
      const npUnits = computedUnits[waveIndex];
      return {
        wave: (waveIndex + 1) as 1 | 2 | 3,
        npUnits,
        npPercent: npUnitsToPercent(npUnits),
        enemyCount,
        overkillHitsPerEnemy: overkillHits,
      };
    }) as unknown as [SystemRefundWaveResult, SystemRefundWaveResult, SystemRefundWaveResult];

    return [{
      servant,
      waves,
      totalNpPercent: waves.reduce((sum, wave) => sum + wave.npPercent, 0),
      usesProbabilisticEffect,
      ...(selectedTimeline ? { attackerSkillPlan: selectedTimeline.actionsByWave } : {}),
    }];
  });

  rows.sort((left, right) =>
    waveValue(right, sortBy) - waveValue(left, sortBy)
    || left.servant.name.localeCompare(right.servant.name, "ja"),
  );

  let previousValue: number | undefined;
  let previousRank = 0;
  return rows.map((row, index) => {
    const value = waveValue(row, sortBy);
    const rank = value === previousValue ? previousRank : index + 1;
    previousValue = value;
    previousRank = rank;
    return { ...row, rank };
  });
}
