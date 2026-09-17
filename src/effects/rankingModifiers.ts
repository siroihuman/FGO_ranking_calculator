import { normalizeRankingEffect } from "./normalizeEffect.js";
import type {
  NormalizedRankingEffect,
  ServantSkillData,
} from "./types.js";
import type {
  CommandCardType,
  ServantStatusRecord,
} from "../types/servant.js";

export type OverchargeStage = 1 | 2 | 3 | 4 | 5;

export interface RankingModifierOptions {
  includeSkills?: boolean;
  includeConditionalEffects?: boolean;
  cardType?: CommandCardType;
  includeAllCardTypes?: boolean;
  noblePhantasm?: boolean;
  overchargeStage?: OverchargeStage;
  includeNoblePhantasmPreAttackEffects?: boolean;
}

export interface RankingModifierTotals {
  attackModPermille: number;
  defenseModPermille: number;
  cardPerformanceModPermille: number;
  cardResistancePermille: number;
  npDamageModPermille: number;
  npGainModPermille: number;
  starGenerationModPermille: number;
  fixedDamage: number;
  usesProbabilisticEffect: boolean;
  appliedEffects: NormalizedRankingEffect[];
}

export function currentRankingSkills(
  skills: readonly ServantSkillData[] | undefined,
): ServantSkillData[] {
  if (!skills) return [];
  return ([1, 2, 3] as const).flatMap((slot) => {
    const matches = skills.filter((skill) => skill.slot === slot);
    if (matches.length === 0) return [];
    const strengthened = matches.filter((skill) => skill.strengthened);
    return [strengthened.at(-1) ?? matches.at(-1)!];
  });
}

function sourceTarget(effect: NormalizedRankingEffect): boolean {
  return effect.target === "self" || effect.target === "all_allies";
}

function enemyTarget(effect: NormalizedRankingEffect): boolean {
  return effect.target === "enemy_single" || effect.target === "all_enemies";
}

function matchesCard(
  effect: NormalizedRankingEffect,
  cardType: CommandCardType | undefined,
  includeAllCardTypes: boolean,
): boolean {
  if (includeAllCardTypes) return true;
  return effect.cardType === undefined || effect.cardType === cardType;
}

function allowedEffect(
  effect: NormalizedRankingEffect,
  options: RankingModifierOptions,
): boolean {
  if (effect.isSpecialAttack) return false;
  if (!options.includeConditionalEffects && effect.conditionText) return false;
  return matchesCard(
    effect,
    options.cardType,
    options.includeAllCardTypes ?? false,
  );
}

function percentToPermille(value: number | undefined): number {
  return value === undefined ? 0 : Math.round(value * 10);
}

function noblePhantasmPreAttackEffects(
  servant: ServantStatusRecord,
  overchargeStage: OverchargeStage,
): NormalizedRankingEffect[] {
  const rows = servant.noblePhantasm?.effectRows ?? [];
  let previousTarget: NormalizedRankingEffect["target"] | undefined;
  return rows.flatMap((row) => {
    if (row.phase !== "before_attack") return [];
    const value = row.values[overchargeStage - 1] ?? row.values[0];
    const effect = normalizeRankingEffect(row.rawText, value, previousTarget);
    if (effect.target !== "unknown") previousTarget = effect.target;
    return [effect];
  });
}

export function activeRankingEffects(
  servant: ServantStatusRecord,
  options: RankingModifierOptions = {},
): NormalizedRankingEffect[] {
  const effects: NormalizedRankingEffect[] = [];
  servant.classSkills?.forEach((skill) => effects.push(...skill.effects));
  if (options.includeSkills) {
    currentRankingSkills(servant.skills).forEach((skill) => effects.push(...skill.effects));
  }
  if (options.includeNoblePhantasmPreAttackEffects && options.noblePhantasm) {
    effects.push(...noblePhantasmPreAttackEffects(servant, options.overchargeStage ?? 1));
  }
  return effects.filter((effect) => allowedEffect(effect, options));
}

/** Resolves already-selected effects into the same modifier buckets used by rankings. */
export function resolveEffectModifierTotals(
  effects: readonly NormalizedRankingEffect[],
  options: RankingModifierOptions = {},
): RankingModifierTotals {
  const appliedEffects = effects.filter((effect) => allowedEffect(effect, options));
  const totals: RankingModifierTotals = {
    attackModPermille: 0,
    defenseModPermille: 0,
    cardPerformanceModPermille: 0,
    cardResistancePermille: 0,
    npDamageModPermille: 0,
    npGainModPermille: 0,
    starGenerationModPermille: 0,
    fixedDamage: 0,
    usesProbabilisticEffect: false,
    appliedEffects,
  };

  for (const effect of appliedEffects) {
    totals.usesProbabilisticEffect ||= effect.probabilistic;
    if (effect.type === "attack" && sourceTarget(effect)) {
      totals.attackModPermille += percentToPermille(effect.value);
    } else if (effect.type === "defense" && enemyTarget(effect)) {
      totals.defenseModPermille += percentToPermille(effect.value);
    } else if (effect.type === "card_performance" && sourceTarget(effect)) {
      totals.cardPerformanceModPermille += percentToPermille(effect.value);
    } else if (effect.type === "card_resistance" && enemyTarget(effect)) {
      totals.cardResistancePermille += percentToPermille(effect.value);
    } else if (effect.type === "noble_phantasm_damage" && sourceTarget(effect) && options.noblePhantasm) {
      totals.npDamageModPermille += percentToPermille(effect.value);
    } else if (effect.type === "np_gain" && sourceTarget(effect)) {
      totals.npGainModPermille += percentToPermille(effect.value);
    } else if (effect.type === "star_generation" && sourceTarget(effect)) {
      totals.starGenerationModPermille += percentToPermille(effect.value);
    } else if (effect.type === "fixed_damage" && sourceTarget(effect)) {
      totals.fixedDamage += effect.value ?? 0;
    }
  }
  return totals;
}

export function resolveRankingModifierTotals(
  servant: ServantStatusRecord,
  options: RankingModifierOptions = {},
): RankingModifierTotals {
  return resolveEffectModifierTotals(activeRankingEffects(servant, options), options);
}
