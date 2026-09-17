import type { SystemActionDefinition } from "./actionSimulator.js";
import { simulateSystemActionPlan } from "./actionSimulator.js";
import type { SystemPreset } from "./presets.js";

export interface SimulatePresetSystemOptions {
  refundByWave: readonly [number, number, number];
  attackerActions?: readonly SystemActionDefinition[];
  attackerActionsByWave?: readonly [readonly string[], readonly string[], readonly string[]];
  /**
   * Full ordered plan override. Use this when cooldown reduction and attacker
   * skill order within the same wave matters.
   */
  actionsByWave?: readonly [readonly string[], readonly string[], readonly string[]];
  postNoblePhantasmNpByWave?: readonly [number, number, number];
}

function mergedPlan(
  preset: SystemPreset,
  attackerPlan: readonly [readonly string[], readonly string[], readonly string[]] | undefined,
): readonly [readonly string[], readonly string[], readonly string[]] {
  if (!attackerPlan) return preset.defaultActionsByWave;
  return [0, 1, 2].map((index) => [
    ...preset.defaultActionsByWave[index],
    ...attackerPlan[index],
  ]) as unknown as readonly [readonly string[], readonly string[], readonly string[]];
}

/**
 * Simulates the NP/CT portion of one registered system preset. Support actions
 * from the preset and parsed attacker NP-charge actions share the same runtime,
 * allowing support cooldown reduction to make attacker skills reusable.
 */
export function simulatePresetSystem(
  preset: SystemPreset,
  options: SimulatePresetSystemOptions,
) {
  const attackerActions = options.attackerActions ?? [];
  const actions = [...preset.actions, ...attackerActions];
  const actionsByWave = options.actionsByWave
    ?? mergedPlan(preset, options.attackerActionsByWave);

  return simulateSystemActionPlan({
    initialNp: preset.initialNp,
    refundByWave: options.refundByWave,
    actions,
    actionsByWave,
    ...(options.postNoblePhantasmNpByWave
      ? { postNoblePhantasmNpByWave: options.postNoblePhantasmNpByWave }
      : {}),
  });
}
