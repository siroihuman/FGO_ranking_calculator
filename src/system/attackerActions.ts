import type { ServantSkillData } from "../effects/types.js";
import type { ServantStatusRecord } from "../types/servant.js";
import type { SystemActionDefinition } from "./actionSimulator.js";

export interface AttackerSystemActionOptions {
  includeConditionalEffects?: boolean;
}

function currentSkills(skills: readonly ServantSkillData[] | undefined): ServantSkillData[] {
  if (!skills) return [];
  return ([1, 2, 3] as const).flatMap((slot) => {
    const candidates = skills.filter((skill) => skill.slot === slot);
    if (candidates.length === 0) return [];
    const strengthened = candidates.filter((skill) => skill.strengthened);
    return [strengthened.at(-1) ?? candidates.at(-1)!];
  });
}

function canChargeAttacker(target: string): boolean {
  return target === "self" || target === "ally_single" || target === "all_allies";
}

/**
 * Converts the attacker's current (strengthened-preferred) NP charge skills
 * into generic system actions. Only NP that can legally be placed on the
 * attacker is included. Conditional effects are omitted unless requested.
 */
export function buildAttackerNpChargeActions(
  servant: ServantStatusRecord,
  options: AttackerSystemActionOptions = {},
): SystemActionDefinition[] {
  const includeConditional = options.includeConditionalEffects ?? false;

  return currentSkills(servant.skills).flatMap((skill) => {
    const chargeEffects = skill.effects.filter((effect) =>
      effect.type === "np_charge"
      && canChargeAttacker(effect.target)
      && (effect.value ?? 0) > 0
      && (includeConditional || !effect.conditionText),
    );
    if (chargeEffects.length === 0) return [];

    const npGrant = chargeEffects.reduce((sum, effect) => sum + (effect.value ?? 0), 0);
    const conditional = chargeEffects.some((effect) => Boolean(effect.conditionText));
    const probabilistic = chargeEffects.some((effect) => effect.probabilistic);

    return [{
      id: `attacker-s${skill.slot}`,
      label: `自身S${skill.slot}: ${skill.name}`,
      owner: "attacker",
      ...(skill.ct === undefined ? { maxUses: 1 } : { cooldownTurns: skill.ct, maxUses: 3 }),
      npGrant,
      conditional,
      probabilistic,
    }];
  });
}
