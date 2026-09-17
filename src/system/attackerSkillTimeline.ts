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
import {
  loadoutInitialNpBonus,
  loadoutSkillReloadingUses,
  mysticCodeTimelineAction,
  type SystemExternalTimelineAction,
  type SystemLoadout,
} from "./systemLoadout.js";

export interface AttackerSkillTimelineOptions {
  conditionalEffects?: boolean;
  cardType: CommandCardType;
  includeAttackerSkills?: boolean;
  loadout?: SystemLoadout;
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
    skillReloadingEligible: true,
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
  externalIdsByWave: readonly [readonly string[], readonly string[], readonly string[]],
  orderMask: number,
): [string[], string[], string[]] {
  return [0, 1, 2].map((index) => {
    const support = [...preset.defaultActionsByWave[index], ...externalIdsByWave[index]];
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

function addTimedEffects(
  active: ActiveTimedEffect[],
  effects: readonly NormalizedRankingEffect[],
  wave: number,
  conditionalEffects: boolean,
): void {
  for (const effect of effects) {
    if (!conditionalEffects && effect.conditionText) continue;
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

function timelineWaves(
  skills: readonly ServantSkillData[],
  attackerIdsByWave: readonly [readonly string[], readonly string[], readonly string[]],
  externalIdsByWave: readonly [readonly string[], readonly string[], readonly string[]],
  externalAction: SystemExternalTimelineAction | undefined,
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
      addTimedEffects(active, skill.effects, wave, options.conditionalEffects ?? false);
    }

    if (
      externalAction?.effects
      && externalIdsByWave[index].includes(externalAction.action.id)
    ) {
      addTimedEffects(
        active,
        externalAction.effects,
        wave,
        options.conditionalEffects ?? false,
      );
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

/** Enumerates legal three-wave self-skill and Mystic Code timelines. */
export function enumerateAttackerSkillTimelines(
  servant: ServantStatusRecord,
  preset: SystemPreset,
  options: AttackerSkillTimelineOptions,
): AttackerSkillTimeline[] {
  const skills = options.includeAttackerSkills === false
    ? []
    : currentRankingSkills(servant.skills);
  const externalAction = mysticCodeTimelineAction(options.loadout?.mysticCode);
  const attackerActions = skills.map((skill) =>
    skillAction(skill, options.conditionalEffects ?? false),
  );
  const allActions = [
    ...preset.actions,
    ...attackerActions,
    ...(externalAction ? [externalAction.action] : []),
  ];
  const maskLimit = 1 << skills.length;
  const results: AttackerSkillTimeline[] = [];
  const seen = new Set<string>();
  const externalWaveCandidates = externalAction ? [0, 1, 2, 3] : [0];

  for (let wave1Mask = 0; wave1Mask < maskLimit; wave1Mask += 1) {
    for (let wave2Mask = 0; wave2Mask < maskLimit; wave2Mask += 1) {
      for (let wave3Mask = 0; wave3Mask < maskLimit; wave3Mask += 1) {
        const attackerIdsByWave: [string[], string[], string[]] = [
          selectedIds(wave1Mask, skills),
          selectedIds(wave2Mask, skills),
          selectedIds(wave3Mask, skills),
        ];

        for (const externalWave of externalWaveCandidates) {
          const externalIdsByWave: [string[], string[], string[]] = [[], [], []];
          if (externalAction && externalWave > 0) {
            externalIdsByWave[externalWave - 1].push(externalAction.action.id);
          }
          const timeline = timelineWaves(
            skills,
            attackerIdsByWave,
            externalIdsByWave,
            externalAction,
            options,
          );

          for (let orderMask = 0; orderMask < 8; orderMask += 1) {
            const actionsByWave = planForOrderMode(
              preset,
              attackerIdsByWave,
              externalIdsByWave,
              orderMask,
            );
            const key = JSON.stringify(actionsByWave);
            if (seen.has(key)) continue;
            seen.add(key);

            const simulation = simulateSystemActionPlan({
              initialNp: preset.initialNp + loadoutInitialNpBonus(options.loadout),
              refundByWave: [100, 100, 100],
              actions: allActions,
              actionsByWave,
              ...(preset.postNoblePhantasmNpByWave
                ? { postNoblePhantasmNpByWave: preset.postNoblePhantasmNpByWave }
                : {}),
              skillReloadingUses: loadoutSkillReloadingUses(options.loadout),
            });
            if (simulation.invalidActions.length > 0) continue;

            const skillUses = attackerIdsByWave.reduce((sum, ids) => sum + ids.length, 0)
              + externalIdsByWave.reduce((sum, ids) => sum + ids.length, 0);
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
  }

  return results;
}