import type {
  SystemActionDefinition,
  SystemActionPlanResult,
  SystemWave,
} from "./actionSimulator.js";
import { simulateSystemActionPlan } from "./actionSimulator.js";
import type { SystemPreset } from "./presets.js";

export interface SystemOptimizationOptions {
  initialNp: number;
  refundByWave: readonly [number, number, number];
  actions: readonly SystemActionDefinition[];
  postNoblePhantasmNpByWave?: readonly [number, number, number];
  maxUsesPerActionPerWave?: number;
}

export interface SystemOptimizationResult {
  established: boolean;
  actionsByWave?: readonly [readonly string[], readonly string[], readonly string[]];
  simulation?: SystemActionPlanResult;
}

interface SearchState {
  waveIndex: number;
  np: number;
  cooldowns: Map<string, number>;
  totalUses: Map<string, number>;
  plan: [string[], string[], string[]];
  conditionalUses: number;
  probabilisticUses: number;
  actionUses: number;
}

interface Candidate {
  state: SearchState;
  simulation: SystemActionPlanResult;
}

function cloneMap(map: ReadonlyMap<string, number>): Map<string, number> {
  return new Map(map.entries());
}

function maxUses(action: SystemActionDefinition): number {
  return action.maxUses ?? 3;
}

function legalOnWave(action: SystemActionDefinition, wave: SystemWave): boolean {
  return !action.allowedWaves || action.allowedWaves.includes(wave);
}

function targetsAction(target: SystemActionDefinition, source: SystemActionDefinition): boolean {
  const reduction = source.cooldownReduction;
  if (!reduction) return false;
  if (reduction.targetActionIds?.includes(target.id)) return true;
  return reduction.targetOwner !== undefined && reduction.targetOwner === target.owner;
}

function useAction(
  state: SearchState,
  action: SystemActionDefinition,
  actionMap: ReadonlyMap<string, SystemActionDefinition>,
): SearchState {
  const currentGain = action.npCurrentGainPermille ?? 0;
  const nextNp = state.np + (action.npGrant ?? 0) + state.np * currentGain / 1000;
  const next: SearchState = {
    ...state,
    np: nextNp,
    cooldowns: cloneMap(state.cooldowns),
    totalUses: cloneMap(state.totalUses),
    plan: state.plan.map((wave) => [...wave]) as [string[], string[], string[]],
    conditionalUses: state.conditionalUses + (action.conditional ? 1 : 0),
    probabilisticUses: state.probabilisticUses + (action.probabilistic ? 1 : 0),
    actionUses: state.actionUses + 1,
  };

  next.plan[state.waveIndex].push(action.id);
  next.totalUses.set(action.id, (next.totalUses.get(action.id) ?? 0) + 1);
  next.cooldowns.set(action.id, action.cooldownTurns ?? 0);

  if (action.cooldownReduction) {
    for (const target of actionMap.values()) {
      if (!targetsAction(target, action)) continue;
      const current = next.cooldowns.get(target.id) ?? 0;
      next.cooldowns.set(target.id, Math.max(0, current - action.cooldownReduction.turns));
    }
  }
  return next;
}

function tickCooldowns(cooldowns: ReadonlyMap<string, number>): Map<string, number> {
  return new Map([...cooldowns].map(([id, value]) => [id, Math.max(0, value - 1)]));
}

function stateKey(state: SearchState): string {
  const cooldowns = [...state.cooldowns].sort(([a], [b]) => a.localeCompare(b));
  const uses = [...state.totalUses].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([
    state.waveIndex,
    Math.round(state.np * 1_000_000) / 1_000_000,
    cooldowns,
    uses,
    state.plan[state.waveIndex],
  ]);
}

function betterCandidate(left: Candidate | undefined, right: Candidate): Candidate {
  if (!left) return right;
  const l = left.state;
  const r = right.state;
  if (r.actionUses !== l.actionUses) return r.actionUses < l.actionUses ? right : left;
  if (r.conditionalUses !== l.conditionalUses) return r.conditionalUses < l.conditionalUses ? right : left;
  if (r.probabilisticUses !== l.probabilisticUses) return r.probabilisticUses < l.probabilisticUses ? right : left;
  const rText = JSON.stringify(r.plan);
  const lText = JSON.stringify(l.plan);
  return rText.localeCompare(lText) < 0 ? right : left;
}

/** Finds a legal three-wave NP plan. */
export function optimizeThreeWaveSystem(
  options: SystemOptimizationOptions,
): SystemOptimizationResult {
  const actionMap = new Map(options.actions.map((action) => [action.id, action]));
  if (actionMap.size !== options.actions.length) throw new RangeError("system actions must have unique ids");
  const cooldowns = new Map(options.actions.map((action) => [action.id, 0]));
  const uses = new Map(options.actions.map((action) => [action.id, 0]));
  const maxPerWave = options.maxUsesPerActionPerWave ?? 2;
  let best: Candidate | undefined;
  const visited = new Set<string>();

  const searchWave = (state: SearchState, perWaveUses: Map<string, number>): void => {
    const wave = (state.waveIndex + 1) as SystemWave;
    const key = stateKey(state);
    if (visited.has(key)) return;
    visited.add(key);

    if (state.np >= 100) {
      if (state.waveIndex === 2) {
        const simulation = simulateSystemActionPlan({
          initialNp: options.initialNp,
          refundByWave: options.refundByWave,
          actions: options.actions,
          actionsByWave: state.plan,
          ...(options.postNoblePhantasmNpByWave ? { postNoblePhantasmNpByWave: options.postNoblePhantasmNpByWave } : {}),
        });
        if (simulation.established) best = betterCandidate(best, { state, simulation });
      } else {
        const nextNp = options.refundByWave[state.waveIndex]
          + (options.postNoblePhantasmNpByWave?.[state.waveIndex] ?? 0);
        searchWave({
          ...state,
          waveIndex: state.waveIndex + 1,
          np: nextNp,
          cooldowns: tickCooldowns(state.cooldowns),
          plan: state.plan.map((entries) => [...entries]) as [string[], string[], string[]],
        }, new Map());
      }
    }

    for (const action of options.actions) {
      if (!legalOnWave(action, wave)) continue;
      if ((state.cooldowns.get(action.id) ?? 0) > 0) continue;
      if ((state.totalUses.get(action.id) ?? 0) >= maxUses(action)) continue;
      if ((perWaveUses.get(action.id) ?? 0) >= maxPerWave) continue;

      const nextPerWaveUses = cloneMap(perWaveUses);
      nextPerWaveUses.set(action.id, (nextPerWaveUses.get(action.id) ?? 0) + 1);
      searchWave(useAction(state, action, actionMap), nextPerWaveUses);
    }
  };

  searchWave({
    waveIndex: 0,
    np: options.initialNp,
    cooldowns,
    totalUses: uses,
    plan: [[], [], []],
    conditionalUses: 0,
    probabilisticUses: 0,
    actionUses: 0,
  }, new Map());

  if (!best) return { established: false };
  return { established: true, actionsByWave: best.state.plan, simulation: best.simulation };
}

function combinePostNp(
  preset: readonly [number, number, number] | undefined,
  extra: readonly [number, number, number] | undefined,
): readonly [number, number, number] | undefined {
  if (!preset && !extra) return undefined;
  return [0, 1, 2].map((index) => (preset?.[index] ?? 0) + (extra?.[index] ?? 0)) as [number, number, number];
}

export function optimizePresetSystem(
  preset: SystemPreset,
  options: Omit<SystemOptimizationOptions, "initialNp" | "actions"> & {
    attackerActions?: readonly SystemActionDefinition[];
  },
): SystemOptimizationResult {
  const postNp = combinePostNp(preset.postNoblePhantasmNpByWave, options.postNoblePhantasmNpByWave);
  return optimizeThreeWaveSystem({
    initialNp: preset.initialNp,
    refundByWave: options.refundByWave,
    actions: [...preset.actions, ...(options.attackerActions ?? [])],
    ...(postNp ? { postNoblePhantasmNpByWave: postNp } : {}),
    ...(options.maxUsesPerActionPerWave !== undefined ? { maxUsesPerActionPerWave: options.maxUsesPerActionPerWave } : {}),
  });
}
