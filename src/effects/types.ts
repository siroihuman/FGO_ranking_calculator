import type { CommandCardType } from "../types/servant.js";

export type RankingEffectType =
  | "attack"
  | "defense"
  | "card_performance"
  | "card_resistance"
  | "noble_phantasm_damage"
  | "critical_damage"
  | "np_gain"
  | "star_generation"
  | "np_charge"
  | "instant_stars"
  | "star_focus"
  | "fixed_damage"
  | "sure_hit"
  | "special_attack"
  | "other";

export type RankingEffectTarget =
  | "self"
  | "ally_single"
  | "all_allies"
  | "all_allies_except_self"
  | "enemy_single"
  | "all_enemies"
  | "unknown";

export type RankingEffectUnit =
  | "percent"
  | "np_percent"
  | "stars"
  | "flat"
  | "state";

export interface NormalizedRankingEffect {
  type: RankingEffectType;
  target: RankingEffectTarget;
  rawText: string;
  value?: number;
  unit: RankingEffectUnit;
  cardType?: CommandCardType;
  durationTurns?: number;
  remainingUses?: number;
  probabilistic: boolean;
  activationRatePercent?: number;
  conditionText?: string;
  isSpecialAttack: boolean;
}

export interface ServantSkillData {
  slot: 1 | 2 | 3;
  name: string;
  strengthened: boolean;
  ct?: number;
  effects: NormalizedRankingEffect[];
}

export interface ServantClassSkillData {
  name: string;
  effects: NormalizedRankingEffect[];
}
