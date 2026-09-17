import { assertSafeInteger, clampInteger, floorDiv, multiplyThenFloor } from "../core/numeric.js";

export const NP_ONE_PERCENT = 100;
export const NP_FULL_GAUGE = 10_000;
export type NoblePhantasmLevel = 1 | 2 | 3 | 4 | 5;

export function npCap(npLevel: NoblePhantasmLevel): number {
  if (npLevel === 1) return 10_000;
  if (npLevel === 5) return 30_000;
  return 20_000;
}

export function addNp(current: number, addition: number, npLevel: NoblePhantasmLevel): number {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(addition)) {
    throw new RangeError("NP values must be safe integers");
  }
  const cap = npCap(npLevel);
  let result = clampInteger(current + addition, 0, cap);
  if (addition > 0 && result >= 9_900 && result < NP_FULL_GAUGE) result = NP_FULL_GAUGE;
  return result;
}

export interface AttackNpInput {
  baseNpUnits: number;
  cardNpValuePermille: number;
  cardPerformanceModPermille?: number;
  cardResistancePermille?: number;
  firstCardBonusPermille?: number;
  targetNpRatePermille: number;
  npGainModPermille?: number;
  criticalModifierPermille?: number;
  overkillOrOvergaugeByHit: readonly boolean[];
}

export interface NpCardResult {
  baseUnitsPerHit: number;
  normalHits: number;
  overkillHits: number;
  totalUnits: number;
}

function safe(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  assertSafeInteger(resolved, name);
  return resolved;
}

function positiveFactor(modifier: number): number {
  return Math.max(0, Math.min(5000, 1000 + modifier));
}

export function calculateAttackNp(input: AttackNpInput): NpCardResult {
  const cardFactor = Math.max(
    0,
    positiveFactor(safe(input.cardPerformanceModPermille, 0, "cardPerformanceModPermille"))
      - safe(input.cardResistancePermille, 0, "cardResistancePermille"),
  );
  const cardTerm = safe(input.firstCardBonusPermille, 0, "firstCardBonusPermille") * 1000
    + safe(input.cardNpValuePermille, 0, "cardNpValuePermille") * cardFactor;
  assertSafeInteger(cardTerm, "cardTerm");

  const baseUnitsPerHit = multiplyThenFloor(
    [
      safe(input.baseNpUnits, 0, "baseNpUnits"),
      cardTerm,
      safe(input.targetNpRatePermille, 0, "targetNpRatePermille"),
      positiveFactor(safe(input.npGainModPermille, 0, "npGainModPermille")),
      safe(input.criticalModifierPermille, 1000, "criticalModifierPermille"),
    ],
    1_000_000_000_000_000,
  );

  const overkillHits = input.overkillOrOvergaugeByHit.filter(Boolean).length;
  const normalHits = input.overkillOrOvergaugeByHit.length - overkillHits;
  const halfUnits = baseUnitsPerHit * (normalHits * 2 + overkillHits * 3);
  assertSafeInteger(halfUnits, "NP half-units");
  return {
    baseUnitsPerHit,
    normalHits,
    overkillHits,
    totalUnits: floorDiv(halfUnits, 2),
  };
}
