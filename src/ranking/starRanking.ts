import type {
  ServantCommandCardCounts,
  ServantSource,
  ServantStatusRecord,
} from "../types/servant.js";
import {
  calculateNormalCardExpectedStars,
  type FirstCardStarBonus,
} from "../formulas/cardStars.js";
import type { CommandPosition, NormalCardType } from "../formulas/cardNp.js";

export interface StarRankingServant {
  id: string;
  source: ServantSource;
  pageUrl: string;
  no: string;
  name: string;
  starRate: number;
  quickHits?: number;
  artsHits?: number;
  busterHits?: number;
  extraHits?: number;
  cards: ServantCommandCardCounts;
}

export interface StarRankingOptions {
  cardType: NormalCardType;
  position?: CommandPosition;
  firstCardBonus?: FirstCardStarBonus;
  critical?: boolean;
  overkillHits?: number;
  enemyStarRatePermille?: number;
  source?: "all" | ServantSource;
}

export interface StarRankingEntry extends StarRankingServant {
  rank: number;
  expectedStars: number;
  hits: number;
}

export function starRankingServantsFromStatus(
  records: readonly ServantStatusRecord[],
): StarRankingServant[] {
  return records.flatMap((record) => {
    const hidden = record.hidden;
    if (!hidden || hidden.starRate === undefined || !record.cards) return [];
    return [{
      id: record.id,
      source: record.source,
      pageUrl: record.pageUrl,
      no: record.no,
      name: record.name,
      starRate: hidden.starRate,
      quickHits: hidden.quickHits,
      artsHits: hidden.artsHits,
      busterHits: hidden.busterHits,
      extraHits: hidden.extraHits,
      cards: record.cards,
    }];
  });
}

function hitsFor(servant: StarRankingServant, cardType: NormalCardType): number | undefined {
  if (cardType === "quick") return servant.cards.quick > 0 ? servant.quickHits : undefined;
  if (cardType === "arts") return servant.cards.arts > 0 ? servant.artsHits : undefined;
  if (cardType === "buster") return servant.cards.buster > 0 ? servant.busterHits : undefined;
  return servant.extraHits;
}

export function buildStarRanking(
  servants: readonly StarRankingServant[],
  options: StarRankingOptions,
): StarRankingEntry[] {
  const source = options.source ?? "all";
  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const hits = hitsFor(servant, options.cardType);
    if (hits === undefined || hits <= 0) return [];
    const expectedStars = calculateNormalCardExpectedStars({
      starRate: servant.starRate,
      cardType: options.cardType,
      position: options.position,
      hits,
      firstCardBonus: options.firstCardBonus,
      critical: options.critical,
      overkillHits: options.overkillHits,
      enemyStarRatePermille: options.enemyStarRatePermille,
    });
    return [{ ...servant, rank: 0, expectedStars, hits }];
  });

  rows.sort((left, right) =>
    right.expectedStars - left.expectedStars
    || left.no.localeCompare(right.no, "ja", { numeric: true })
    || left.name.localeCompare(right.name, "ja"),
  );

  let previousValue: number | undefined;
  let previousRank = 0;
  rows.forEach((row, index) => {
    if (previousValue === undefined || row.expectedStars !== previousValue) {
      previousRank = index + 1;
      previousValue = row.expectedStars;
    }
    row.rank = previousRank;
  });
  return rows;
}
