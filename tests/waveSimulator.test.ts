import { describe, expect, it } from "vitest";
import { simulateSequentialThreeWaveSystem } from "../src/system/waveSimulator.js";

describe("simulateSequentialThreeWaveSystem", () => {
  it("accepts the canonical Quick pattern: 50% refund + 50% NP grant", () => {
    const result = simulateSequentialThreeWaveSystem({
      initialNp: 100,
      refundByWave: [50, 50, 50],
      npGrantBeforeWave2: 50,
      npGrantBeforeWave3: 50,
    });

    expect(result.established).toBe(true);
    expect(result.waves.map((wave) => wave.npBeforeNoblePhantasm)).toEqual([100, 100, 100]);
    expect(result.waves[0].npForNextWave).toBe(100);
    expect(result.waves[1].npForNextWave).toBe(100);
  });

  it("rejects 49% refund + 50% NP grant because the next wave only reaches 99%", () => {
    const result = simulateSequentialThreeWaveSystem({
      initialNp: 100,
      refundByWave: [49, 50, 50],
      npGrantBeforeWave2: 50,
      npGrantBeforeWave3: 50,
    });

    expect(result.established).toBe(false);
    expect(result.failedWave).toBe(2);
    expect(result.waves[0].npForNextWave).toBe(99);
    expect(result.waves[0].shortageForNextWave).toBe(1);
  });

  it("does not require 100% NP refund when grants make up the difference", () => {
    const result = simulateSequentialThreeWaveSystem({
      initialNp: 100,
      refundByWave: [63.5, 74.2, 40],
      npGrantBeforeWave2: 36.5,
      npGrantBeforeWave3: 25.8,
    });

    expect(result.established).toBe(true);
  });
});
