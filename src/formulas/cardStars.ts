import { calculateStarRate, expectedStarsForHit } from "./stars.js";
import type { CommandPosition, NormalCardType } from "./cardNp.js";

export type FirstCardStarBonus = "none" | "quick" | "mighty";

const CARD_STAR_VALUE: Record<Exclude<NormalCardType, "extra">, readonly [number, number, number]> = {
  buster: [100, 150, 200],
  arts: [0, 0, 0],
  quick: [800, 1300, 1800],
};

export interface NormalCardStarInput {
  starRate: number;
  cardType: NormalCardType;
  position?: CommandPosition;
  hits: number;
  firstCardBonus?: FirstCardStarBonus;
  critical?: boolean;
  overkillHits?: number;
  enemyStarRatePermille?: number;
  cardPerformanceModPermille?: number;
  cardResistancePermille?: number;
  starGenerationModPermille?: number;
  enemyStarGenerationModPermille?: number;
}

export function sourceStarRateToBasisPoints(starRate: number): number {
  if (!Number.isFinite(starRate) || starRate < 0) {
    throw new RangeError("starRate must be a non-negative finite number");
  }
  return Math.round(starRate * 100);
}

export function calculateNormalCardExpectedStars(input: NormalCardStarInput): number {
  if (!Number.isInteger(input.hits) || input.hits < 0) {
    throw new RangeError("hits must be a non-negative integer");
  }
  const overkillHits = input.overkillHits ?? 0;
  if (!Number.isInteger(overkillHits) || overkillHits < 0 || overkillHits > input.hits) {
    throw new RangeError("overkillHits must be between 0 and hits");
  }
  const position = input.position ?? 1;
  const cardStarValuePermille = input.cardType === "extra"
    ? 1000
    : CARD_STAR_VALUE[input.cardType][position - 1];
  const firstCardBonusPermille = input.firstCardBonus === "quick" || input.firstCardBonus === "mighty"
    ? 200
    : 0;
  const common = {
    servantStarRatePermille: Math.floor(input.starRate * 10),
    servantStarRateBasisPoints: sourceStarRateToBasisPoints(input.starRate),
    cardStarValuePermille,
    cardPerformanceModPermille: input.cardPerformanceModPermille,
    cardResistancePermille: input.cardResistancePermille,
    firstCardBonusPermille,
    enemyStarRatePermille: input.enemyStarRatePermille ?? 0,
    starGenerationModPermille: input.starGenerationModPermille,
    enemyStarGenerationModPermille: input.enemyStarGenerationModPermille,
    criticalBonusPermille: input.critical ? 200 : 0,
  };
  const normalRate = calculateStarRate({ ...common, isOverkillOrOvergauge: false });
  const overkillRate = calculateStarRate({ ...common, isOverkillOrOvergauge: true });
  return expectedStarsForHit(normalRate) * (input.hits - overkillHits)
    + expectedStarsForHit(overkillRate) * overkillHits;
}
