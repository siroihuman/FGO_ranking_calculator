import {
  resolveRankingModifierTotals,
  type OverchargeStage,
} from "../effects/rankingModifiers.js";
import { calculateNoblePhantasmNp } from "../formulas/noblePhantasmNp.js";
import { npUnitsToPercent } from "../formulas/cardNp.js";
import type { ServantSource, ServantStatusRecord } from "../types/servant.js";
import type { SystemPreset } from "./presets.js";
import {
  resolveSystemModifiers,
  systemOverchargeStage,
} from "./supportModifiers.js";

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
}

function waveValue(entry: Omit<SystemRefundRankingEntry, "rank">, sortBy: SystemRefundSort): number {
  if (sortBy === "wave1") return entry.waves[0].npUnits;
  if (sortBy === "wave2") return entry.waves[1].npUnits;
  if (sortBy === "wave3") return entry.waves[2].npUnits;
  return entry.waves.reduce((sum, wave) => sum + wave.npUnits, 0);
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

  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const np = servant.noblePhantasm;
    const npGainRate = servant.hidden?.npGainRate;
    const hitCount = np?.hitCount ?? servant.hidden?.noblePhantasmHits;
    if (!np || np.targetScope === "support" || np.cardType !== preset.cardType) return [];
    if (npGainRate === undefined || hitCount === undefined) return [];

    let usesProbabilisticEffect = false;
    const waves = [0, 1, 2].map((waveIndex) => {
      const support = preset.supportModifiersByWave?.[waveIndex];
      const oc = systemOverchargeStage(baseOc, support);
      const attacker = resolveRankingModifierTotals(servant, {
        includeSkills: options.includeAttackerSkills ?? false,
        includeConditionalEffects: options.conditionalEffects ?? false,
        cardType: np.cardType,
        noblePhantasm: true,
        overchargeStage: oc,
        includeNoblePhantasmPreAttackEffects: true,
      });
      usesProbabilisticEffect ||= attacker.usesProbabilisticEffect;
      const modifiers = resolveSystemModifiers(attacker, support);
      const enemyCount = options.enemyCountByWave?.[waveIndex]
        ?? (np.targetScope === "all" ? 3 : 1);
      const overkillHits = options.overkillHitsPerEnemy
        ?? Math.ceil(hitCount / 2);
      const npUnits = calculateNoblePhantasmNp({
        npGainRate,
        cardType: np.cardType,
        hits: hitCount,
        enemyCount,
        targetNpRatePermille: targetNpRate,
        overkillHitsPerEnemy: overkillHits,
        cardPerformanceModPermille: modifiers.cardPerformanceModPermille,
        cardResistancePermille: modifiers.cardResistancePermille,
        npGainModPermille: modifiers.npGainModPermille,
      });
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
