import {
  currentRankingSkills,
  resolveEffectModifierTotals,
  type RankingModifierTotals,
} from "../effects/rankingModifiers.js";
import type {
  NormalizedRankingEffect,
  ServantSkillData,
} from "../effects/types.js";
import type {
  CommandCardType,
  ServantStatusRecord,
} from "../types/servant.js";
import {
  simulateSystemActionPlan,
  type SystemActionDefinition,
} from "./actionSimulator.js";
import type { SystemPreset } from "./presets.js";

export interface AttackerSkillTimelineOptions {
  conditionalEffects?: boolean;
  cardType: CommandCardType;
}

export interface AttackerSkillTimelineWave {
  wave: 1 | 2 | 3;
  usedSkillIds: readonly string[];
  activeEffects: readonly NormalizedRankingEffect[];
  modifiers: RankingModifierTotals;
}

export interface AttackerSkillTimeline {
  actionsByWave: readonly [readonly string[], readonly string[], readonly string[]];
  waves: readonly [
    AttackerSkillTimelineWave,
    AttackerSkillTimelineWave,
    AttackerSkillTimelineWave,
  ];
  skillUses: number;
  usesConditionalEffect: boolean;
  usesProbabilisticEffect: boolean;
}

interface ActiveTimedEffect {
  effect: NormalizedRankingEffect;
  expiresAfterWave: number;
  usesRemaining?: number;
}

function canChargeAttacker(target: string): boolean {
  return target === "self" || target === "ally_single" || target === "all_allies";
}

function skillAction(
  skill: ServantSkillData,
  includeConditional: boolean,
): SystemActionDefinition {
  const chargeEffects = skill.effects.filter((effect) =>
    effect.type === "np_charge"
    && canChargeAttacker(effect.target)
    && (effect.value ?? 0) > 0
    && (includeConditional || !effect.conditionText),
  );
  const npGrant = chargeEffects.reduce((sum, effect) => sum + (effect.value ?? 0), 0);
  return {
    id: `attacker-s${skill.slot}`,
    label: `自身S${skill.slot}: ${skill.name}`,
    owner: "attacker",
    ...(skill.ct === undefined
      ? { maxUses: 1 }
      : { cooldownTurns: skill.ct, maxUses: 3 }),
    ...(npGrant > 0 ? { npGrant } : {}),
    conditional: skill.effects.some((effect) => Boolean(effect.conditionText)),
    probabilistic: skill.effects.some((effect) => effect.probabilistic),
  };
}

export function buildAttackerSkillActions(
  servant: ServantStatusRecord,
  options: { conditionalEffects?: boolean } = {},
): SystemActionDefinition[] {
  const includeConditional = options.conditionalEffects ?? false;
  return currentRankingSkills(servant.skills).map((skill) =>
    skillAction(skill, includeConditional),
  );
}

function selectedIds(mask: number, skills: readonly ServantSkillData[]): string[] {
  return skills.flatMap((skill, index) =>
    mask & (1 << index) ? [`attacker-s${skill.slot}`] : [],
  );
}

function planForOrderMode(
  preset: SystemPreset,
  attackerIdsByWave: readonly [readonly string[], readonly string[], readonly string[]],
  orderMask: number,
): [string[], string[], string[]] {
  return [0, 1, 2].map((index) => {
    const support = [...preset.defaultActionsByWave[index]];
    const attacker = [...attackerIdsByWave[index]];
    return orderMask & (1 << index)
      ? [...attacker, ...support]
      : [...support, ...attacker];
  }) as [string[], string[], string[]];
}

function enemyTarget(effect: NormalizedRankingEffect): boolean {
  return effect.target === "enemy_single" || effect.target === "all_enemies";
}

function consumesOnNoblePhantasm(
  effect: NormalizedRankingEffect,
  cardType: CommandCardType,
): boolean {
  if (effect.cardType !== undefined && effect.cardType !== cardType) return false;
  return effect.type === "attack"
    || effect.type === "defense"
    || effect.type === "card_performance"
    || effect.type === "card_resistance"
    || effect.type === "noble_phantasm_damage"
    || effect.type === "np_gain"
    || effect.type === "fixed_damage";
}

function timelineWaves(
  skills: readonly ServantSkillData[],
  attackerIdsByWave: readonly [readonly string[], readonly string[], readonly string[]],
  options: AttackerSkillTimelineOptions,
): [AttackerSkillTimelineWave, AttackerSkillTimelineWave, AttackerSkillTimelineWave] {
  const skillById = new Map(skills.map((skill) => [`attacker-s${skill.slot}`, skill]));
  let active: ActiveTimedEffect[] = [];
  const waves: AttackerSkillTimelineWave[] = [];

  for (let index = 0; index < 3; index += 1) {
    const wave = index + 1;
    const usedSkillIds = [...attackerIdsByWave[index]];

    for (const id of usedSkillIds) {
      const skill = skillById.get(id);
      if (!skill) continue;
      for (const effect of skill.effects) {
        if (!options.conditionalEffects && effect.conditionText) continue;
        const duration = Math.max(1, effect.durationTurns ?? 1);
        active.push({
          effect,
          expiresAfterWave: enemyTarget(effect) ? wave : wave + duration - 1,
          ...(effect.remainingUses !== undefined
            ? { usesRemaining: effect.remainingUses }
            : {}),
        });
      }
    }

    const activeEffects = active.map((entry) => entry.effect);
    waves.push({
      wave: wave as 1 | 2 | 3,
      usedSkillIds,
      activeEffects,
      modifiers: resolveEffectModifierTotals(activeEffects, {
        includeConditionalEffects: options.conditionalEffects ?? false,
        cardType: options.cardType,
        noblePhantasm: true,
      }),
    });

    active = active.filter((entry) => {
      if (
        entry.usesRemaining !== undefined
        && consumesOnNoblePhantasm(entry.effect, options.cardType)
      ) {
        entry.usesRemaining -= 1;
      }
      if (entry.usesRemaining !== undefined && entry.usesRemaining <= 0) return false;
      return wave < entry.expiresAfterWave;
    });
  }

  return waves as [
    AttackerSkillTimelineWave,
    AttackerSkillTimelineWave,
    AttackerSkillTimelineWave,
  ];
}

/**
 * Enumerates legal three-wave self-skill timelines.
 *
 * Each of the attacker's three current skills may be used at most once per
 * wave. Re-use on later waves is permitted only when its parsed CT and preset
 * cooldown reductions make that use legal. For waves containing cooldown
 * reduction, both "support first" and "attacker first" orders are tested.
 */
export function enumerateAttackerSkillTimelines(
  servant: ServantStatusRecord,
  preset: SystemPreset,
  options: AttackerSkillTimelineOptions,
): AttackerSkillTimeline[] {
  const skills = currentRankingSkills(servant.skills);
  if (skills.length === 0) {
    const empty: [readonly string[], readonly string[], readonly string[]] = [[], [], []];
    return [{
      actionsByWave: preset.defaultActionsByWave,
      waves: timelineWaves(skills, empty, options),
      skillUses: 0,
      usesConditionalEffect: false,
      usesProbabilisticEffect: false,
    }];
  }

  const attackerActions = skills.map((skill) =>
    skillAction(skill, options.conditionalEffects ?? false),
  );
  const allActions = [...preset.actions, ...attackerActions];
  const maskLimit = 1 << skills.length;
  const results: AttackerSkillTimeline[] = [];
  const seen = new Set<string>();

  for (let wave1Mask = 0; wave1Mask < maskLimit; wave1Mask += 1) {
    for (let wave2Mask = 0; wave2Mask < maskLimit; wave2Mask += 1) {
      for (let wave3Mask = 0; wave3Mask < maskLimit; wave3Mask += 1) {
        const attackerIdsByWave: [string[], string[], string[]] = [
          selectedIds(wave1Mask, skills),
          selectedIds(wave2Mask, skills),
          selectedIds(wave3Mask, skills),
        ];
        const timeline = timelineWaves(skills, attackerIdsByWave, options);

        for (let orderMask = 0; orderMask < 8; orderMask += 1) {
          const actionsByWave = planForOrderMode(preset, attackerIdsByWave, orderMask);
          const key = JSON.stringify(actionsByWave);
          if (seen.has(key)) continue;
          seen.add(key);

          const simulation = simulateSystemActionPlan({
            initialNp: preset.initialNp,
            refundByWave: [100, 100, 100],
            actions: allActions,
            actionsByWave,
            ...(preset.postNoblePhantasmNpByWave
              ? { postNoblePhantasmNpByWave: preset.postNoblePhantasmNpByWave }
              : {}),
          });
          if (simulation.invalidActions.length > 0) continue;

          const skillUses = attackerIdsByWave.reduce((sum, ids) => sum + ids.length, 0);
          results.push({
            actionsByWave,
            waves: timeline,
            skillUses,
            usesConditionalEffect: timeline.some((wave) =>
              wave.activeEffects.some((effect) => Boolean(effect.conditionText)),
            ),
            usesProbabilisticEffect: timeline.some((wave) =>
              wave.activeEffects.some((effect) => effect.probabilistic),
            ),
          });
          break;
        }
      }
    }
  }

  return results;
}
