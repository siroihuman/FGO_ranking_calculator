import type { ServantSource } from "../types/servant.js";
import type { CommandCardCounts } from "../parsers/cardDeckParser.js";
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
  cards: CommandCardCounts;
}

export interface NpRankingOptions {
  cardType: NormalCardType;
  position?: CommandPosition;
  firstCardBonus?: FirstCardNpBonus;
  targetNpRatePermille?: number;
  critical?: boolean;
  overkillHits?: number;
  source?: "all" | ServantSource;
}

export interface NpRankingEntry extends NpRankingServant {
  rank: number;
  npUnits: number;
  npPercent: number;
  hits: number;
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
    const npUnits = calculateNormalCardNp({
      npGainRate: servant.npGainRate,
      cardType: options.cardType,
      position: options.position,
      hits,
      firstCardBonus: options.firstCardBonus,
      targetNpRatePermille: options.targetNpRatePermille,
      critical: options.critical,
      overkillHits: options.overkillHits,
    });
    return [{ ...servant, rank: 0, npUnits, npPercent: npUnitsToPercent(npUnits), hits }];
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
