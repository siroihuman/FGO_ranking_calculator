import type { ServantStatusRecord } from "../types/servant.js";

export type StatusRankingKind = "hp" | "atk";
export type StatusLevel = "max" | 100 | 120;
export type FouBonus = 0 | 1000 | 2000;

export interface StatusRankingOptions {
  kind: StatusRankingKind;
  level: StatusLevel;
  fou: FouBonus;
  source?: "all" | "official" | "original";
}

export interface StatusRankingEntry {
  rank: number;
  servant: ServantStatusRecord;
  value: number;
}

function rawValue(
  servant: ServantStatusRecord,
  kind: StatusRankingKind,
  level: StatusLevel,
): number | null {
  const status = servant.status;
  if (level === "max") {
    return kind === "hp" ? status.hpMax : status.atkMax;
  }
  if (level === 100) {
    return kind === "hp" ? status.hp100 ?? null : status.atk100 ?? null;
  }
  return kind === "hp" ? status.hp120 ?? null : status.atk120 ?? null;
}

export function buildStatusRanking(
  servants: readonly ServantStatusRecord[],
  options: StatusRankingOptions,
): StatusRankingEntry[] {
  const source = options.source ?? "all";
  const rows = servants
    .filter((servant) => source === "all" || servant.source === source)
    .map((servant) => {
      const base = rawValue(servant, options.kind, options.level);
      return base === null
        ? null
        : { servant, value: base + options.fou };
    })
    .filter((row): row is { servant: ServantStatusRecord; value: number } => row !== null)
    .sort((a, b) => b.value - a.value || a.servant.name.localeCompare(b.servant.name, "ja"));

  let previousValue: number | null = null;
  let previousRank = 0;

  return rows.map((row, index) => {
    const rank = row.value === previousValue ? previousRank : index + 1;
    previousValue = row.value;
    previousRank = rank;
    return { ...row, rank };
  });
}
