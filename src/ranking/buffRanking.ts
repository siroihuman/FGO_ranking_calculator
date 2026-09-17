import { activeRankingEffects } from "../effects/rankingModifiers.js";
import type {
  NormalizedRankingEffect,
  RankingEffectType,
} from "../effects/types.js";
import type {
  CommandCardType,
  ServantSource,
  ServantStatusRecord,
} from "../types/servant.js";

export type BuffRankingTarget = "self" | "ally";
export type BuffRankingCategory =
  | "total"
  | "attack"
  | "buster"
  | "arts"
  | "quick"
  | "noble_phantasm_damage"
  | "critical_damage"
  | "np_gain"
  | "star_generation";

export interface BuffBreakdown {
  attack: number;
  buster: number;
  arts: number;
  quick: number;
  noblePhantasmDamage: number;
  criticalDamage: number;
  npGain: number;
  starGeneration: number;
  total: number;
}

export interface BuffRankingOptions {
  target: BuffRankingTarget;
  category?: BuffRankingCategory;
  source?: ServantSource | "all";
  conditionalEffects?: boolean;
}

export interface BuffRankingEntry {
  rank: number;
  servant: ServantStatusRecord;
  value: number;
  breakdown: BuffBreakdown;
  usesProbabilisticEffect: boolean;
  appliedEffects: NormalizedRankingEffect[];
}

const INCLUDED_TYPES = new Set<RankingEffectType>([
  "attack",
  "card_performance",
  "noble_phantasm_damage",
  "critical_damage",
  "np_gain",
  "star_generation",
]);

function appliesToTarget(
  effect: NormalizedRankingEffect,
  target: BuffRankingTarget,
): boolean {
  if (target === "self") {
    return effect.target === "self" || effect.target === "all_allies";
  }
  return effect.target === "ally_single"
    || effect.target === "all_allies"
    || effect.target === "all_allies_except_self";
}

function positivePercent(effect: NormalizedRankingEffect): number {
  if (effect.unit !== "percent") return 0;
  return Math.max(0, effect.value ?? 0);
}

function addCardValue(
  breakdown: BuffBreakdown,
  cardType: CommandCardType | undefined,
  value: number,
): void {
  if (cardType === "buster") breakdown.buster += value;
  if (cardType === "arts") breakdown.arts += value;
  if (cardType === "quick") breakdown.quick += value;
}

function buildBreakdown(effects: readonly NormalizedRankingEffect[]): BuffBreakdown {
  const result: BuffBreakdown = {
    attack: 0,
    buster: 0,
    arts: 0,
    quick: 0,
    noblePhantasmDamage: 0,
    criticalDamage: 0,
    npGain: 0,
    starGeneration: 0,
    total: 0,
  };
  for (const effect of effects) {
    const value = positivePercent(effect);
    if (value <= 0) continue;
    if (effect.type === "attack") result.attack += value;
    if (effect.type === "card_performance") addCardValue(result, effect.cardType, value);
    if (effect.type === "noble_phantasm_damage") result.noblePhantasmDamage += value;
    if (effect.type === "critical_damage") result.criticalDamage += value;
    if (effect.type === "np_gain") result.npGain += value;
    if (effect.type === "star_generation") result.starGeneration += value;
  }
  result.total = result.attack
    + result.buster
    + result.arts
    + result.quick
    + result.noblePhantasmDamage
    + result.criticalDamage
    + result.npGain
    + result.starGeneration;
  return result;
}

function rankingValue(
  breakdown: BuffBreakdown,
  category: BuffRankingCategory,
): number {
  if (category === "total") return breakdown.total;
  if (category === "attack") return breakdown.attack;
  if (category === "buster") return breakdown.buster;
  if (category === "arts") return breakdown.arts;
  if (category === "quick") return breakdown.quick;
  if (category === "noble_phantasm_damage") return breakdown.noblePhantasmDamage;
  if (category === "critical_damage") return breakdown.criticalDamage;
  if (category === "np_gain") return breakdown.npGain;
  return breakdown.starGeneration;
}

export function buildBuffRanking(
  servants: readonly ServantStatusRecord[],
  options: BuffRankingOptions,
): BuffRankingEntry[] {
  const source = options.source ?? "all";
  const category = options.category ?? "total";
  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const effects = activeRankingEffects(servant, {
      includeSkills: true,
      includeConditionalEffects: options.conditionalEffects ?? false,
    }).filter((effect) =>
      INCLUDED_TYPES.has(effect.type)
      && !effect.isSpecialAttack
      && appliesToTarget(effect, options.target)
      && positivePercent(effect) > 0,
    );
    const breakdown = buildBreakdown(effects);
    const value = rankingValue(breakdown, category);
    return [{
      servant,
      value,
      breakdown,
      usesProbabilisticEffect: effects.some((effect) => effect.probabilistic),
      appliedEffects: effects,
    }];
  });

  rows.sort((left, right) =>
    right.value - left.value
    || left.servant.name.localeCompare(right.servant.name, "ja"),
  );

  let previousValue: number | undefined;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = row.value === previousValue ? previousRank : index + 1;
    previousValue = row.value;
    previousRank = rank;
    return { ...row, rank };
  });
}
