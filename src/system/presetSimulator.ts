import type { SystemActionDefinition } from "./actionSimulator.js";
import { simulateSystemActionPlan } from "./actionSimulator.js";
import type { SystemPreset } from "./presets.js";

export interface SimulatePresetSystemOptions {
  refundByWave: readonly [number, number, number];
  attackerActions?: readonly SystemActionDefinition[];
  attackerActionsByWave?: readonly [readonly string[], readonly string[], readonly string[]];
  /** Full ordered plan override when same-wave action order matters. */
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

function mergedPostNp(
  preset: readonly [number, number, number] | undefined,
  extra: readonly [number, number, number] | undefined,
): readonly [number, number, number] | undefined {
  if (!preset && !extra) return undefined;
  return [0, 1, 2].map((index) => (preset?.[index] ?? 0) + (extra?.[index] ?? 0)) as [number, number, number];
}

/** Simulates the NP/CT portion of one registered system preset. */
export function simulatePresetSystem(
  preset: SystemPreset,
  options: SimulatePresetSystemOptions,
) {
  const attackerActions = options.attackerActions ?? [];
  const actions = [...preset.actions, ...attackerActions];
  const actionsByWave = options.actionsByWave
    ?? mergedPlan(preset, options.attackerActionsByWave);
  const postNp = mergedPostNp(
    preset.postNoblePhantasmNpByWave,
    options.postNoblePhantasmNpByWave,
  );

  return simulateSystemActionPlan({
    initialNp: preset.initialNp,
    refundByWave: options.refundByWave,
    actions,
    actionsByWave,
    ...(postNp ? { postNoblePhantasmNpByWave: postNp } : {}),
  });
}
