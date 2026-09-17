export type SystemWave = 1 | 2 | 3;

export interface SystemCooldownReduction {
  turns: number;
  targetOwner?: string;
  targetActionIds?: readonly string[];
}

export interface SystemActionDefinition {
  id: string;
  label: string;
  owner: string;
  cooldownTurns?: number;
  maxUses?: number;
  allowedWaves?: readonly SystemWave[];
  /** Flat NP percentage added immediately. */
  npGrant?: number;
  /** Additional NP based on the current gauge. 1000 = +100% of current NP. */
  npCurrentGainPermille?: number;
  cooldownReduction?: SystemCooldownReduction;
  /** Whether Append Skill 5 may advance this action's own cooldown after use. */
  skillReloadingEligible?: boolean;
  conditional?: boolean;
  probabilistic?: boolean;
}

export interface SystemActionUseResult {
  actionId: string;
  label: string;
  wave: SystemWave;
  valid: boolean;
  reason?: string;
  npBefore: number;
  npAfter: number;
  cooldownBefore: number;
  cooldownAfter: number;
  skillReloadingApplied?: boolean;
}

export interface SystemActionWaveResult {
  wave: SystemWave;
  npAtWaveStart: number;
  actionUses: SystemActionUseResult[];
  npBeforeNoblePhantasm: number;
  canFire: boolean;
  shortage: number;
  noblePhantasmRefund: number;
  postNoblePhantasmNp: number;
  npAtWaveEnd: number;
}

export interface SystemActionPlanResult {
  established: boolean;
  waves: SystemActionWaveResult[];
  failedWave?: SystemWave;
  invalidActions: SystemActionUseResult[];
  usesConditionalAction: boolean;
  usesProbabilisticAction: boolean;
}

export interface SystemActionPlanInput {
  initialNp: number;
  refundByWave: readonly [number, number, number];
  actions: readonly SystemActionDefinition[];
  actionsByWave: readonly [readonly string[], readonly string[], readonly string[]];
  postNoblePhantasmNpByWave?: readonly [number, number, number];
  /** Append Skill 5 activations available. Each eligible action can consume it once. */
  skillReloadingUses?: number;
}

interface ActionRuntimeState {
  cooldown: number;
  uses: number;
}

function nonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return value;
}

function targetsAction(
  action: SystemActionDefinition,
  reduction: SystemCooldownReduction,
): boolean {
  if (reduction.targetActionIds?.includes(action.id)) return true;
  return reduction.targetOwner !== undefined && reduction.targetOwner === action.owner;
}

function applyCooldownReduction(
  actions: ReadonlyMap<string, SystemActionDefinition>,
  states: Map<string, ActionRuntimeState>,
  reduction: SystemCooldownReduction | undefined,
): void {
  if (!reduction) return;
  const turns = nonNegativeInteger(reduction.turns, "cooldownReduction.turns");
  for (const [id, definition] of actions) {
    if (!targetsAction(definition, reduction)) continue;
    const state = states.get(id);
    if (!state) continue;
    state.cooldown = Math.max(0, state.cooldown - turns);
  }
}

function tickCooldowns(states: Map<string, ActionRuntimeState>): void {
  for (const state of states.values()) {
    state.cooldown = Math.max(0, state.cooldown - 1);
  }
}

function applyNpAction(currentNp: number, action: SystemActionDefinition): number {
  const flat = nonNegativeFinite(action.npGrant ?? 0, `${action.id}.npGrant`);
  const currentGain = nonNegativeFinite(
    action.npCurrentGainPermille ?? 0,
    `${action.id}.npCurrentGainPermille`,
  );
  return currentNp + flat + currentNp * currentGain / 1000;
}

/** Simulates one explicitly ordered three-wave action plan. */
export function simulateSystemActionPlan(
  input: SystemActionPlanInput,
): SystemActionPlanResult {
  let currentNp = nonNegativeFinite(input.initialNp, "initialNp");
  const actionMap = new Map<string, SystemActionDefinition>();
  const runtime = new Map<string, ActionRuntimeState>();
  let skillReloadingRemaining = nonNegativeInteger(
    input.skillReloadingUses ?? 0,
    "skillReloadingUses",
  );
  const reloadedActionIds = new Set<string>();

  for (const action of input.actions) {
    if (actionMap.has(action.id)) throw new RangeError(`duplicate system action id: ${action.id}`);
    if (action.cooldownTurns !== undefined) nonNegativeInteger(action.cooldownTurns, `${action.id}.cooldownTurns`);
    if (action.maxUses !== undefined) nonNegativeInteger(action.maxUses, `${action.id}.maxUses`);
    nonNegativeFinite(action.npGrant ?? 0, `${action.id}.npGrant`);
    nonNegativeFinite(action.npCurrentGainPermille ?? 0, `${action.id}.npCurrentGainPermille`);
    actionMap.set(action.id, action);
    runtime.set(action.id, { cooldown: 0, uses: 0 });
  }

  const waves: SystemActionWaveResult[] = [];
  const invalidActions: SystemActionUseResult[] = [];
  let failedWave: SystemWave | undefined;
  let usesConditionalAction = false;
  let usesProbabilisticAction = false;

  for (let waveIndex = 0; waveIndex < 3; waveIndex += 1) {
    const wave = (waveIndex + 1) as SystemWave;
    const npAtWaveStart = currentNp;
    const actionUses: SystemActionUseResult[] = [];

    for (const actionId of input.actionsByWave[waveIndex]) {
      const definition = actionMap.get(actionId);
      const state = runtime.get(actionId);
      if (!definition || !state) {
        const invalid: SystemActionUseResult = { actionId, label: actionId, wave, valid: false, reason: "unknown action", npBefore: currentNp, npAfter: currentNp, cooldownBefore: 0, cooldownAfter: 0 };
        actionUses.push(invalid);
        invalidActions.push(invalid);
        continue;
      }

      const npBefore = currentNp;
      const cooldownBefore = state.cooldown;
      let reason: string | undefined;
      if (definition.allowedWaves && !definition.allowedWaves.includes(wave)) reason = `action is not allowed on wave ${wave}`;
      else if (state.cooldown > 0) reason = `cooldown remaining: ${state.cooldown}`;
      else if (definition.maxUses !== undefined && state.uses >= definition.maxUses) reason = "maximum uses reached";

      if (reason) {
        const invalid: SystemActionUseResult = { actionId, label: definition.label, wave, valid: false, reason, npBefore, npAfter: currentNp, cooldownBefore, cooldownAfter: state.cooldown };
        actionUses.push(invalid);
        invalidActions.push(invalid);
        continue;
      }

      currentNp = applyNpAction(currentNp, definition);
      state.uses += 1;
      state.cooldown = definition.cooldownTurns ?? 0;

      let skillReloadingApplied = false;
      if (
        definition.skillReloadingEligible
        && skillReloadingRemaining > 0
        && !reloadedActionIds.has(definition.id)
      ) {
        state.cooldown = Math.max(0, state.cooldown - 1);
        skillReloadingRemaining -= 1;
        reloadedActionIds.add(definition.id);
        skillReloadingApplied = true;
      }

      applyCooldownReduction(actionMap, runtime, definition.cooldownReduction);
      usesConditionalAction ||= definition.conditional ?? false;
      usesProbabilisticAction ||= definition.probabilistic ?? false;

      actionUses.push({
        actionId,
        label: definition.label,
        wave,
        valid: true,
        npBefore,
        npAfter: currentNp,
        cooldownBefore,
        cooldownAfter: state.cooldown,
        ...(skillReloadingApplied ? { skillReloadingApplied: true } : {}),
      });
    }

    const npBeforeNoblePhantasm = currentNp;
    const canFire = npBeforeNoblePhantasm >= 100;
    if (!canFire && failedWave === undefined) failedWave = wave;
    const refund = nonNegativeFinite(input.refundByWave[waveIndex], `refundByWave[${waveIndex}]`);
    const postNp = nonNegativeFinite(input.postNoblePhantasmNpByWave?.[waveIndex] ?? 0, `postNoblePhantasmNpByWave[${waveIndex}]`);

    currentNp = canFire ? refund + postNp : npBeforeNoblePhantasm;
    waves.push({ wave, npAtWaveStart, actionUses, npBeforeNoblePhantasm, canFire, shortage: Math.max(0, 100 - npBeforeNoblePhantasm), noblePhantasmRefund: refund, postNoblePhantasmNp: postNp, npAtWaveEnd: currentNp });
    tickCooldowns(runtime);
  }

  return {
    established: failedWave === undefined && invalidActions.length === 0,
    waves,
    ...(failedWave === undefined ? {} : { failedWave }),
    invalidActions,
    usesConditionalAction,
    usesProbabilisticAction,
  };
}