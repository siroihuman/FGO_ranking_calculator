import { calculateAttackNp } from "./np.js";
import type { CommandCardType } from "../types/servant.js";
import { sourceNpRateToUnits } from "./cardNp.js";

const NP_CARD_VALUE_PERMILLE: Record<CommandCardType, number> = {
  buster: 0,
  arts: 3000,
  quick: 1000,
};

export interface NoblePhantasmNpInput {
  npGainRate: number;
  cardType: CommandCardType;
  hits: number;
  enemyCount?: number;
  targetNpRatePermille?: number;
  overkillHitsPerEnemy?: number;
  cardPerformanceModPermille?: number;
  cardResistancePermille?: number;
  npGainModPermille?: number;
}

/**
 * Calculates attack NP recovered by one damaging Noble Phantasm.
 *
 * This mirrors FGO_Battle_Simulator_Work: NP cards use first-position card
 * NP values, never receive first-card NP bonuses, calculate one-Hit NP first,
 * floor there, and then add normal/overkill Hits. Multi-target NP is the sum
 * of the independently calculated target results.
 */
export function calculateNoblePhantasmNp(input: NoblePhantasmNpInput): number {
  if (!Number.isInteger(input.hits) || input.hits < 0) {
    throw new RangeError("hits must be a non-negative integer");
  }
  const enemyCount = input.enemyCount ?? 1;
  if (!Number.isInteger(enemyCount) || enemyCount < 1) {
    throw new RangeError("enemyCount must be a positive integer");
  }
  const overkillHits = input.overkillHitsPerEnemy ?? 0;
  if (!Number.isInteger(overkillHits) || overkillHits < 0 || overkillHits > input.hits) {
    throw new RangeError("overkillHitsPerEnemy must be between 0 and hits");
  }

  const flags = Array.from({ length: input.hits }, (_, index) =>
    index >= input.hits - overkillHits,
  );
  const perTarget = calculateAttackNp({
    baseNpUnits: sourceNpRateToUnits(input.npGainRate),
    cardNpValuePermille: NP_CARD_VALUE_PERMILLE[input.cardType],
    cardPerformanceModPermille: input.cardPerformanceModPermille,
    cardResistancePermille: input.cardResistancePermille,
    firstCardBonusPermille: 0,
    targetNpRatePermille: input.targetNpRatePermille ?? 1000,
    npGainModPermille: input.npGainModPermille,
    criticalModifierPermille: 1000,
    overkillOrOvergaugeByHit: flags,
  }).totalUnits;

  return perTarget * enemyCount;
}
