import type { NormalizedRankingEffect } from "../effects/types.js";
import { resolveRankingModifierTotals } from "../effects/rankingModifiers.js";
import type {
  ServantCommandCardCounts,
  ServantSource,
  ServantStatusRecord,
} from "../types/servant.js";
import {
  calculateNormalCardNp,
  npUnitsToPercent,
  type CommandPosition,
  type FirstCardNpBonus,
  type NormalCardType,
} from "../formulas/cardNp.js";

export interface NpRankingServant {
  id: string;
  source: ServantSource;
  pageUrl: string;
  no: string;
  name: string;
  npGainRate: number;
  quickHits?: number;
  artsHits?: number;
  busterHits?: number;
  extraHits?: number;
  cards: ServantCommandCardCounts;
  record?: ServantStatusRecord;
}

export interface NpRankingOptions {
  cardType: NormalCardType;
  position?: CommandPosition;
  firstCardBonus?: FirstCardNpBonus;
  targetNpRatePermille?: number;
  critical?: boolean;
  overkillHits?: number;
  source?: "all" | ServantSource;
  skills?: boolean;
  conditionalEffects?: boolean;
}

export interface NpRankingEntry extends NpRankingServant {
  rank: number;
  npUnits: number;
  npPercent: number;
  hits: number;
  usesProbabilisticEffect: boolean;
  appliedEffects: NormalizedRankingEffect[];
}

export function npRankingServantsFromStatus(
  records: readonly ServantStatusRecord[],
): NpRankingServant[] {
  return records.flatMap((record) => {
    const hidden = record.hidden;
    if (!hidden || hidden.npGainRate === undefined || !record.cards) return [];
    return [{
      id: record.id,
      source: record.source,
      pageUrl: record.pageUrl,
      no: record.no,
      name: record.name,
      npGainRate: hidden.npGainRate,
      quickHits: hidden.quickHits,
      artsHits: hidden.artsHits,
      busterHits: hidden.busterHits,
      extraHits: hidden.extraHits,
      cards: record.cards,
      record,
    }];
  });
}

function hitsFor(servant: NpRankingServant, cardType: NormalCardType): number | undefined {
  if (cardType === "quick") return servant.cards.quick > 0 ? servant.quickHits : undefined;
  if (cardType === "arts") return servant.cards.arts > 0 ? servant.artsHits : undefined;
  if (cardType === "buster") return servant.cards.buster > 0 ? servant.busterHits : undefined;
  return servant.extraHits;
}

export function buildNpRanking(
  servants: readonly NpRankingServant[],
  options: NpRankingOptions,
): NpRankingEntry[] {
  const source = options.source ?? "all";
  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const hits = hitsFor(servant, options.cardType);
    if (hits === undefined || hits <= 0) return [];
    const modifiers = servant.record
      ? resolveRankingModifierTotals(servant.record, {
          includeSkills: options.skills ?? false,
          includeConditionalEffects: options.conditionalEffects ?? false,
          cardType: options.cardType === "extra" ? undefined : options.cardType,
          noblePhantasm: false,
        })
      : undefined;
    const npUnits = calculateNormalCardNp({
      npGainRate: servant.npGainRate,
      cardType: options.cardType,
      position: options.position,
      hits,
      firstCardBonus: options.firstCardBonus,
      targetNpRatePermille: options.targetNpRatePermille,
      critical: options.critical,
      overkillHits: options.overkillHits,
      cardPerformanceModPermille: modifiers?.cardPerformanceModPermille,
      cardResistancePermille: modifiers?.cardResistancePermille,
      npGainModPermille: modifiers?.npGainModPermille,
    });
    return [{
      ...servant,
      rank: 0,
      npUnits,
      npPercent: npUnitsToPercent(npUnits),
      hits,
      usesProbabilisticEffect: modifiers?.usesProbabilisticEffect ?? false,
      appliedEffects: modifiers?.appliedEffects ?? [],
    }];
  });

  rows.sort((left, right) =>
    right.npUnits - left.npUnits
    || left.no.localeCompare(right.no, "ja", { numeric: true })
    || left.name.localeCompare(right.name, "ja"),
  );

  let previousValue: number | undefined;
  let previousRank = 0;
  rows.forEach((row, index) => {
    if (previousValue === undefined || row.npUnits !== previousValue) {
      previousRank = index + 1;
      previousValue = row.npUnits;
    }
    row.rank = previousRank;
  });
  return rows;
}
