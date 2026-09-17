import { clampInteger, floorDiv, multiplyThenFloor } from "../core/numeric.js";

export const STAR_RATE_CAP_PERMILLE = 3000;

export interface StarRateInput {
  servantStarRatePermille: number;
  servantStarRateBasisPoints?: number;
  cardStarValuePermille: number;
  cardPerformanceModPermille?: number;
  cardResistancePermille?: number;
  firstCardBonusPermille?: number;
  enemyStarRatePermille?: number;
  starGenerationModPermille?: number;
  enemyStarGenerationModPermille?: number;
  criticalBonusPermille?: number;
  isOverkillOrOvergauge?: boolean;
}

export function calculateStarRate(input: StarRateInput): number {
  for (const [name, value] of Object.entries(input)) {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      throw new RangeError(`${name} must be a safe integer`);
    }
  }
  const cardFactor = Math.max(
    0,
    Math.min(5000, 1000 + (input.cardPerformanceModPermille ?? 0))
      - (input.cardResistancePermille ?? 0),
  );
  const cardContribution = multiplyThenFloor(
    [input.cardStarValuePermille, cardFactor],
    1000,
  );
  const baseServantRate = input.servantStarRateBasisPoints === undefined
    ? input.servantStarRatePermille
    : floorDiv(input.servantStarRateBasisPoints, 10);
  const baseRate = baseServantRate
    + cardContribution
    + (input.firstCardBonusPermille ?? 0)
    + (input.enemyStarRatePermille ?? 0)
    + (input.starGenerationModPermille ?? 0)
    - (input.enemyStarGenerationModPermille ?? 0)
    + (input.criticalBonusPermille ?? 0);
  return clampInteger(
    baseRate + (input.isOverkillOrOvergauge ? 300 : 0),
    0,
    STAR_RATE_CAP_PERMILLE,
  );
}

/** Expected stars from one Hit: guaranteed stars plus the fractional roll probability. */
export function expectedStarsForHit(ratePermille: number): number {
  const rate = clampInteger(ratePermille, 0, STAR_RATE_CAP_PERMILLE);
  return floorDiv(rate, 1000) + (rate % 1000) / 1000;
}
