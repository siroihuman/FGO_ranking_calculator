import type { SystemActionDefinition, SystemWave } from "./actionSimulator.js";
import { simulateSystemActionPlan } from "./actionSimulator.js";
import type { SystemPreset } from "./presets.js";
import {
  loadoutInitialNpBonus,
  loadoutSkillReloadingUses,
  mysticCodeTimelineAction,
  type SystemLoadout,
} from "./systemLoadout.js";

export interface SimulatePresetSystemOptions {
  refundByWave: readonly [number, number, number];
  attackerActions?: readonly SystemActionDefinition[];
  attackerActionsByWave?: readonly [readonly string[], readonly string[], readonly string[]];
  /** Full ordered plan override when same-wave action order matters. */
  actionsByWave?: readonly [readonly string[], readonly string[], readonly string[]];
  postNoblePhantasmNpByWave?: readonly [number, number, number];
  loadout?: SystemLoadout;
  /** Override the preset's already-prepared Wave1 gauge before Mana Loading. */
  initialNpOverride?: number;
  /** Explicit Mystic Code usage wave for non-optimized simulation. */
  mysticCodeWave?: SystemWave;
}

function mergedPlan(
  preset: SystemPreset,
  attackerPlan: readonly [readonly string[], readonly string[], readonly string[]] | undefined,
  mysticActionId: string | undefined,
  mysticWave: SystemWave | undefined,
): readonly [readonly string[], readonly string[], readonly string[]] {
  return [0, 1, 2].map((index) => [
    ...preset.defaultActionsByWave[index],
    ...(mysticActionId && mysticWave === index + 1 ? [mysticActionId] : []),
    ...(attackerPlan?.[index] ?? []),
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
  const mystic = mysticCodeTimelineAction(options.loadout?.mysticCode);
  const actions = [
    ...preset.actions,
    ...attackerActions,
    ...(mystic ? [mystic.action] : []),
  ];
  const actionsByWave = options.actionsByWave
    ?? mergedPlan(
      preset,
      options.attackerActionsByWave,
      mystic?.action.id,
      options.mysticCodeWave,
    );
  const postNp = mergedPostNp(
    preset.postNoblePhantasmNpByWave,
    options.postNoblePhantasmNpByWave,
  );

  return simulateSystemActionPlan({
    initialNp: (options.initialNpOverride ?? preset.initialNp)
      + loadoutInitialNpBonus(options.loadout),
    refundByWave: options.refundByWave,
    actions,
    actionsByWave,
    ...(postNp ? { postNoblePhantasmNpByWave: postNp } : {}),
    skillReloadingUses: loadoutSkillReloadingUses(options.loadout),
  });
}