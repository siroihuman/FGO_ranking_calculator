import type { RankingModifierTotals } from "../effects/rankingModifiers.js";
import type { SystemSupportModifiers } from "./presets.js";

export interface ResolvedSystemModifiers {
  attackModPermille: number;
  defenseModPermille: number;
  cardPerformanceModPermille: number;
  cardResistancePermille: number;
  npDamageModPermille: number;
  npGainModPermille: number;
  starGenerationModPermille: number;
  fixedDamage: number;
}

function boostedAmount(value: number, boostPermille: number | undefined): number {
  if (!boostPermille) return value;
  return Math.floor(value * (1000 + boostPermille) / 1000);
}

/**
 * Adds preset support buffs to the attacker's already-resolved modifiers.
 *
 * "Card-performance boost" and "NP-damage boost" multiply the corresponding
 * UP amount itself, not the neutral 100% base. Thus Arts +160% with a 50%
 * boost becomes Arts +240%, while NP damage +30% with a 100% boost becomes
 * NP damage +60%.
 */
export function resolveSystemModifiers(
  attacker: RankingModifierTotals,
  support: SystemSupportModifiers | undefined,
): ResolvedSystemModifiers {
  const cardPerformance = attacker.cardPerformanceModPermille
    + (support?.cardPerformanceModPermille ?? 0);
  const npDamage = attacker.npDamageModPermille
    + (support?.npDamageModPermille ?? 0);

  return {
    attackModPermille: attacker.attackModPermille + (support?.attackModPermille ?? 0),
    defenseModPermille: attacker.defenseModPermille,
    cardPerformanceModPermille: boostedAmount(
      cardPerformance,
      support?.cardPerformanceBoostPermille,
    ),
    cardResistancePermille: attacker.cardResistancePermille,
    npDamageModPermille: boostedAmount(
      npDamage,
      support?.npDamageBoostPermille,
    ),
    npGainModPermille: attacker.npGainModPermille + (support?.npGainModPermille ?? 0),
    starGenerationModPermille: attacker.starGenerationModPermille,
    fixedDamage: attacker.fixedDamage,
  };
}

export function systemOverchargeStage(
  baseStage: 1 | 2 | 3 | 4 | 5,
  support: SystemSupportModifiers | undefined,
): 1 | 2 | 3 | 4 | 5 {
  const value = Math.max(1, Math.min(5, baseStage + (support?.overchargeStageIncrease ?? 0)));
  return value as 1 | 2 | 3 | 4 | 5;
}
