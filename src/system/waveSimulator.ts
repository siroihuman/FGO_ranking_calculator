export interface SystemWaveInput {
  /** NP percentage immediately before the Noble Phantasm is fired. */
  npBeforeNoblePhantasm: number;
  /** NP percentage refunded by the Noble Phantasm itself. */
  noblePhantasmRefund: number;
  /** NP percentage granted after the Noble Phantasm and before the next wave. */
  npGrantedBeforeNextWave?: number;
}

export interface SystemWaveResult extends SystemWaveInput {
  wave: 1 | 2 | 3;
  canFire: boolean;
  npAfterNoblePhantasm: number;
  npForNextWave: number;
  shortageForNextWave: number;
}

export interface ThreeWaveSystemResult {
  established: boolean;
  waves: SystemWaveResult[];
  failedWave?: 1 | 2 | 3;
}

function nonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
  return value;
}

/**
 * Evaluates whether the same attacker can fire a Noble Phantasm on all three
 * waves. A wave only requires NP >= 100 immediately before firing. After the
 * Noble Phantasm, refund and any explicitly supplied NP grant are added for
 * the following wave.
 *
 * This deliberately does not require a 100% refund. In particular, the
 * canonical Quick-system case "50% refund + 50% NP grant" is valid.
 */
export function evaluateThreeWaveSystem(
  inputs: readonly [SystemWaveInput, SystemWaveInput, SystemWaveInput],
): ThreeWaveSystemResult {
  const waves: SystemWaveResult[] = [];
  let failedWave: 1 | 2 | 3 | undefined;

  for (let index = 0; index < inputs.length; index += 1) {
    const wave = (index + 1) as 1 | 2 | 3;
    const input = inputs[index];
    const npBefore = nonNegativeFinite(input.npBeforeNoblePhantasm, `wave${wave}.npBeforeNoblePhantasm`);
    const refund = nonNegativeFinite(input.noblePhantasmRefund, `wave${wave}.noblePhantasmRefund`);
    const grant = nonNegativeFinite(input.npGrantedBeforeNextWave ?? 0, `wave${wave}.npGrantedBeforeNextWave`);
    const canFire = npBefore >= 100;
    if (!canFire && failedWave === undefined) failedWave = wave;

    const npAfterNoblePhantasm = canFire ? refund : npBefore;
    const npForNextWave = npAfterNoblePhantasm + grant;
    waves.push({
      ...input,
      wave,
      canFire,
      npAfterNoblePhantasm,
      npForNextWave,
      shortageForNextWave: Math.max(0, 100 - npForNextWave),
    });
  }

  return {
    established: failedWave === undefined,
    waves,
    ...(failedWave === undefined ? {} : { failedWave }),
  };
}

/**
 * Convenience builder for the common case where each wave's starting NP is
 * simply the previous wave's refund plus NP grants.
 */
export function simulateSequentialThreeWaveSystem(options: {
  initialNp: number;
  refundByWave: readonly [number, number, number];
  npGrantBeforeWave2?: number;
  npGrantBeforeWave3?: number;
}): ThreeWaveSystemResult {
  const initialNp = nonNegativeFinite(options.initialNp, "initialNp");
  const refund1 = nonNegativeFinite(options.refundByWave[0], "refundByWave[0]");
  const refund2 = nonNegativeFinite(options.refundByWave[1], "refundByWave[1]");
  const refund3 = nonNegativeFinite(options.refundByWave[2], "refundByWave[2]");
  const grant2 = nonNegativeFinite(options.npGrantBeforeWave2 ?? 0, "npGrantBeforeWave2");
  const grant3 = nonNegativeFinite(options.npGrantBeforeWave3 ?? 0, "npGrantBeforeWave3");

  const wave2Np = refund1 + grant2;
  const wave3Np = refund2 + grant3;
  return evaluateThreeWaveSystem([
    { npBeforeNoblePhantasm: initialNp, noblePhantasmRefund: refund1, npGrantedBeforeNextWave: grant2 },
    { npBeforeNoblePhantasm: wave2Np, noblePhantasmRefund: refund2, npGrantedBeforeNextWave: grant3 },
    { npBeforeNoblePhantasm: wave3Np, noblePhantasmRefund: refund3 },
  ]);
}
