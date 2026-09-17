import { calculateAttackNp } from "./np.js";

export type NormalCardType = "buster" | "arts" | "quick" | "extra";
export type CommandPosition = 1 | 2 | 3;
export type FirstCardNpBonus = "none" | "arts" | "mighty";

const CARD_NP_VALUE: Record<Exclude<NormalCardType, "extra">, readonly [number, number, number]> = {
  buster: [0, 0, 0],
  arts: [3000, 4500, 6000],
  quick: [1000, 1500, 2000],
};

export interface NormalCardNpInput {
  npGainRate: number;
  cardType: NormalCardType;
  position?: CommandPosition;
  hits: number;
  firstCardBonus?: FirstCardNpBonus;
  targetNpRatePermille?: number;
  critical?: boolean;
  overkillHits?: number;
  cardPerformanceModPermille?: number;
  cardResistancePermille?: number;
  npGainModPermille?: number;
}

export function sourceNpRateToUnits(npGainRate: number): number {
  if (!Number.isFinite(npGainRate) || npGainRate < 0) {
    throw new RangeError("npGainRate must be a non-negative finite number");
  }
  return Math.round(npGainRate * 100);
}

export function calculateNormalCardNp(input: NormalCardNpInput): number {
  if (!Number.isInteger(input.hits) || input.hits < 0) {
    throw new RangeError("hits must be a non-negative integer");
  }
  const overkillHits = input.overkillHits ?? 0;
  if (!Number.isInteger(overkillHits) || overkillHits < 0 || overkillHits > input.hits) {
    throw new RangeError("overkillHits must be between 0 and hits");
  }
  const position = input.position ?? 1;
  const cardNpValuePermille = input.cardType === "extra"
    ? 1000
    : CARD_NP_VALUE[input.cardType][position - 1];
  const firstCardBonusPermille = input.firstCardBonus === "arts" || input.firstCardBonus === "mighty"
    ? 1000
    : 0;
  const flags = Array.from({ length: input.hits }, (_, index) =>
    index >= input.hits - overkillHits,
  );

  return calculateAttackNp({
    baseNpUnits: sourceNpRateToUnits(input.npGainRate),
    cardNpValuePermille,
    cardPerformanceModPermille: input.cardPerformanceModPermille,
    cardResistancePermille: input.cardResistancePermille,
    firstCardBonusPermille,
    targetNpRatePermille: input.targetNpRatePermille ?? 1000,
    npGainModPermille: input.npGainModPermille,
    criticalModifierPermille: input.critical ? 2000 : 1000,
    overkillOrOvergaugeByHit: flags,
  }).totalUnits;
}

export function npUnitsToPercent(units: number): number {
  return units / 100;
}
