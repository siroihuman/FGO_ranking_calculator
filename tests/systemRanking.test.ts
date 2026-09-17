import { describe, expect, it } from "vitest";
import { buildSystemDamageRanking } from "../src/system/systemDamageRanking.js";
import { buildSystemRefundRanking } from "../src/system/systemRefundRanking.js";
import {
  CASTORIA_ARTS_PRESET,
  DOUBLE_KOYANSKAYA_BUSTER_PRESET,
  KOYANSKAYA_OBERON_BUSTER_PRESET,
} from "../src/system/presets.js";
import type { CommandCardType, ServantStatusRecord } from "../src/types/servant.js";

function servant(
  name: string,
  cardType: CommandCardType,
  options: { atk?: number; npGainRate?: number; hits?: number } = {},
): ServantStatusRecord {
  const atk = options.atk ?? 10000;
  const hits = options.hits ?? 5;
  return {
    id: `original:${name}`,
    source: "original",
    pageUrl: "https://example.test",
    pageId: name,
    no: name,
    name,
    className: "Saber",
    rarity: 5,
    status: { maxLevel: 90, hpMax: 10000, atkMax: atk },
    hidden: {
      npGainRate: options.npGainRate ?? 0.5,
      noblePhantasmHits: hits,
    },
    noblePhantasm: {
      cardType,
      targetScope: "all",
      hitCount: hits,
      damageMultiplierPermilleByLevel: [3000, 4000, 4500, 4750, 5000],
      effectRows: [],
    },
  };
}

describe("system refund ranking", () => {
  it("applies the selected support preset on every wave", () => {
    const [entry] = buildSystemRefundRanking(
      [servant("Arts", "arts", { npGainRate: 0.5, hits: 5 })],
      CASTORIA_ARTS_PRESET,
      { enemyCountByWave: [3, 2, 1] },
    );

    expect(entry.waves).toHaveLength(3);
    expect(entry.waves[0].npPercent).toBeGreaterThan(entry.waves[1].npPercent);
    expect(entry.waves[1].npPercent).toBeGreaterThan(entry.waves[2].npPercent);
    expect(entry.waves[0].overkillHitsPerEnemy).toBe(3);
  });

  it("excludes Noble Phantasms whose card type does not match the preset", () => {
    expect(buildSystemRefundRanking(
      [servant("Quick", "quick")],
      CASTORIA_ARTS_PRESET,
    )).toHaveLength(0);
  });
});

describe("system damage ranking", () => {
  it("keeps all waves equal when the preset has the same support buffs each wave", () => {
    const [entry] = buildSystemDamageRanking(
      [servant("Buster", "buster")],
      DOUBLE_KOYANSKAYA_BUSTER_PRESET,
      { fou: 0, noblePhantasmLevel: 1 },
    );
    expect(entry.waves[0].averageDamage).toBe(entry.waves[1].averageDamage);
    expect(entry.waves[1].averageDamage).toBe(entry.waves[2].averageDamage);
  });

  it("applies Oberon's NP-damage boost only to wave 3", () => {
    const [entry] = buildSystemDamageRanking(
      [servant("Buster", "buster")],
      KOYANSKAYA_OBERON_BUSTER_PRESET,
      { fou: 0, noblePhantasmLevel: 1 },
    );
    expect(entry.waves[0].averageDamage).toBe(entry.waves[1].averageDamage);
    expect(entry.waves[2].averageDamage).toBeGreaterThan(entry.waves[1].averageDamage);
  });

  it("uses the legacy rarity rule when no NP level is explicitly selected", () => {
    const [entry] = buildSystemDamageRanking(
      [servant("Buster", "buster")],
      DOUBLE_KOYANSKAYA_BUSTER_PRESET,
      { fou: 0 },
    );
    expect(entry.noblePhantasmLevel).toBe(2);
  });
});
