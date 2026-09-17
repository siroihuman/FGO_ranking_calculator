import { calculateDamage } from "../formulas/damage.js";
import {
  resolveRankingModifierTotals,
  type OverchargeStage,
} from "../effects/rankingModifiers.js";
import type { NormalizedRankingEffect } from "../effects/types.js";
import type { CommandCardType, ServantClass, ServantSource, ServantStatusRecord } from "../types/servant.js";
import type { FouBonus, StatusLevel } from "./statusRanking.js";

const NP_CARD_DAMAGE_VALUE_PERMILLE: Record<CommandCardType, number> = {
  buster: 1500,
  arts: 1000,
  quick: 800,
};

const CLASS_ATTACK_COEFFICIENT_PERMILLE: Record<ServantClass, number> = {
  Saber: 1000,
  Archer: 950,
  Lancer: 1050,
  Rider: 1000,
  Caster: 900,
  Assassin: 900,
  Berserker: 1100,
  Ruler: 1000,
  Avenger: 1100,
  MoonCancer: 1000,
  AlterEgo: 1000,
  Foreigner: 1000,
  Pretender: 1000,
  Shielder: 1000,
  Beast: 1000,
  Other: 1000,
};

export type NoblePhantasmLevel = 1 | 2 | 3 | 4 | 5;

export interface NoblePhantasmDamageRankingOptions {
  source?: ServantSource | "all";
  level?: StatusLevel;
  fou?: FouBonus;
  noblePhantasmLevel?: NoblePhantasmLevel;
  cardType?: CommandCardType | "all";
  targetScope?: "single" | "all" | "all_scopes";
  skills?: boolean;
  conditionalEffects?: boolean;
  overchargeStage?: OverchargeStage;
}

export interface NoblePhantasmDamageRankingEntry {
  rank: number;
  servant: ServantStatusRecord;
  minimumDamage: number;
  averageDamage: number;
  maximumDamage: number;
  attack: number;
  usesProbabilisticEffect: boolean;
  appliedEffects: NormalizedRankingEffect[];
}

function attackAtLevel(servant: ServantStatusRecord, level: StatusLevel): number | null {
  if (level === "max") return servant.status.atkMax;
  if (level === 100) return servant.status.atk100 ?? null;
  return servant.status.atk120 ?? null;
}

export function buildNoblePhantasmDamageRanking(
  servants: readonly ServantStatusRecord[],
  options: NoblePhantasmDamageRankingOptions = {},
): NoblePhantasmDamageRankingEntry[] {
  const source = options.source ?? "all";
  const level = options.level ?? "max";
  const fou = options.fou ?? 1000;
  const npLevel = options.noblePhantasmLevel ?? 1;
  const cardType = options.cardType ?? "all";
  const targetScope = options.targetScope ?? "all_scopes";

  const rows = servants.flatMap((servant) => {
    if (source !== "all" && servant.source !== source) return [];
    const np = servant.noblePhantasm;
    if (!np || np.targetScope === "support") return [];
    if (cardType !== "all" && np.cardType !== cardType) return [];
    if (targetScope !== "all_scopes" && np.targetScope !== targetScope) return [];
    const multiplier = np.damageMultiplierPermilleByLevel?.[npLevel - 1];
    if (multiplier === undefined) return [];
    const baseAttack = attackAtLevel(servant, level);
    if (baseAttack === null) return [];
    const attack = baseAttack + fou;
    const modifiers = resolveRankingModifierTotals(servant, {
      includeSkills: options.skills ?? false,
      includeConditionalEffects: options.conditionalEffects ?? false,
      cardType: np.cardType,
      noblePhantasm: true,
      overchargeStage: options.overchargeStage ?? 1,
      includeNoblePhantasmPreAttackEffects: true,
    });
    const damages: number[] = [];
    for (let random = 900; random <= 1099; random += 1) {
      damages.push(calculateDamage({
        attack,
        isNoblePhantasm: true,
        npDamageMultiplierPermille: multiplier,
        cardDamageValuePermille: NP_CARD_DAMAGE_VALUE_PERMILLE[np.cardType],
        cardPerformanceModPermille: modifiers.cardPerformanceModPermille,
        cardResistancePermille: modifiers.cardResistancePermille,
        firstCardBonusPermille: 0,
        classAttackCoefficientPermille: CLASS_ATTACK_COEFFICIENT_PERMILLE[servant.className],
        classAffinityPermille: 1000,
        attributeAffinityPermille: 1000,
        randomModifierPermille: random,
        attackModPermille: modifiers.attackModPermille,
        defenseModPermille: modifiers.defenseModPermille,
        npDamageModPermille: modifiers.npDamageModPermille,
        fixedDamage: modifiers.fixedDamage,
        extraCardModifierPermille: 1000,
        npSpecialAttackPermille: 1000,
      }).damage);
    }
    const total = damages.reduce((sum, damage) => sum + damage, 0);
    return [{
      servant,
      attack,
      minimumDamage: damages[0],
      averageDamage: total / damages.length,
      maximumDamage: damages[damages.length - 1],
      usesProbabilisticEffect: modifiers.usesProbabilisticEffect,
      appliedEffects: modifiers.appliedEffects,
    }];
  });

  rows.sort((left, right) =>
    right.averageDamage - left.averageDamage
    || left.servant.name.localeCompare(right.servant.name, "ja"),
  );

  let previousValue: number | undefined;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = row.averageDamage === previousValue ? previousRank : index + 1;
    previousValue = row.averageDamage;
    previousRank = rank;
    return { ...row, rank };
  });
}
