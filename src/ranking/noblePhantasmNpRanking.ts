import type { ServantSource, ServantStatusRecord } from "../types/servant.js";
import { calculateNoblePhantasmNp } from "../formulas/noblePhantasmNp.js";
import { npUnitsToPercent } from "../formulas/cardNp.js";

export interface NoblePhantasmNpRankingOptions {
  source?: ServantSource | "all";
  enemyCount?: number;
  targetNpRatePermille?: number;
  overkillHitsPerEnemy?: number;
  descending?: boolean;
}

export interface NoblePhantasmNpRankingEntry {
  rank: number;
  servant: ServantStatusRecord;
  npPercent: number;
  npUnits: number;
  hitCount: number;
}

export function buildNoblePhantasmNpRanking(
  servants: readonly ServantStatusRecord[],
  options: NoblePhantasmNpRankingOptions = {},
): NoblePhantasmNpRankingEntry[] {
  const source = options.source ?? "all";
  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const np = servant.noblePhantasm;
    const npGainRate = servant.hidden?.npGainRate;
    const hitCount = np?.hitCount ?? servant.hidden?.noblePhantasmHits;
    if (!np || np.targetScope === "support" || npGainRate === undefined || hitCount === undefined) {
      return [];
    }
    const npUnits = calculateNoblePhantasmNp({
      npGainRate,
      cardType: np.cardType,
      hits: hitCount,
      enemyCount: options.enemyCount ?? (np.targetScope === "all" ? 3 : 1),
      targetNpRatePermille: options.targetNpRatePermille ?? 1000,
      overkillHitsPerEnemy: options.overkillHitsPerEnemy ?? 0,
    });
    return [{ servant, npUnits, npPercent: npUnitsToPercent(npUnits), hitCount }];
  });

  const descending = options.descending ?? true;
  rows.sort((left, right) => {
    const primary = descending
      ? right.npUnits - left.npUnits
      : left.npUnits - right.npUnits;
    return primary || left.servant.name.localeCompare(right.servant.name, "ja");
  });

  let previousValue: number | undefined;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = previousValue === row.npUnits ? previousRank : index + 1;
    previousValue = row.npUnits;
    previousRank = rank;
    return { ...row, rank };
  });
}
