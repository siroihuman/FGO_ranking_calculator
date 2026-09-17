import type { CommandCardType } from "../types/servant.js";
import type {
  SystemActionDefinition,
  SystemWave,
} from "./actionSimulator.js";

export interface SystemPreset {
  id: string;
  name: string;
  cardType: CommandCardType;
  initialNp: number;
  actions: readonly SystemActionDefinition[];
  defaultActionsByWave: readonly [readonly string[], readonly string[], readonly string[]];
  notes?: readonly string[];
}

/**
 * Quick's standard loop: approximately 50% refund from the NP itself, then a
 * 50% NP grant before the next NP. Two independent 50% support grants cover
 * waves 2 and 3.
 */
export const SUMMER_SKADI_QUICK_PRESET: SystemPreset = {
  id: "summer-skadi-quick",
  name: "水着スカサハ＝スカディ・Quick",
  cardType: "quick",
  initialNp: 100,
  actions: [
    {
      id: "summer-skadi-a-np50",
      label: "水着スカディA：NP50%付与",
      owner: "supportA",
      maxUses: 1,
      allowedWaves: [2],
      npGrant: 50,
    },
    {
      id: "summer-skadi-b-np50",
      label: "水着スカディB：NP50%付与",
      owner: "supportB",
      maxUses: 1,
      allowedWaves: [3],
      npGrant: 50,
    },
  ],
  defaultActionsByWave: [
    [],
    ["summer-skadi-a-np50"],
    ["summer-skadi-b-np50"],
  ],
  notes: [
    "Quick宝具の基本成立ラインは、宝具リチャージ約50%＋NP50%付与で次Wave100%到達。",
    "自前NPチャージを使用する場合はアタッカー行動として追加する。",
  ],
};

/**
 * NP-loop portion of the double Koyanskaya Buster setup. Each support action
 * grants 50% NP and advances the attacker's skill cooldowns by two turns.
 * Damage/card buffs are handled separately by the ranking modifier layer.
 */
export const DOUBLE_KOYANSKAYA_BUSTER_PRESET: SystemPreset = {
  id: "double-koyanskaya-buster",
  name: "光のコヤンスカヤ・Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [
    {
      id: "koyanskaya-a-s1",
      label: "光コヤンA S1",
      owner: "supportA",
      maxUses: 1,
      allowedWaves: [2],
      npGrant: 50,
      cooldownReduction: { targetOwner: "attacker", turns: 2 },
    },
    {
      id: "koyanskaya-b-s1",
      label: "光コヤンB S1",
      owner: "supportB",
      maxUses: 1,
      allowedWaves: [3],
      npGrant: 50,
      cooldownReduction: { targetOwner: "attacker", turns: 2 },
    },
  ],
  defaultActionsByWave: [
    [],
    ["koyanskaya-a-s1"],
    ["koyanskaya-b-s1"],
  ],
  notes: [
    "2・3Waveで光コヤンS1を使用するNP/CT部分のプリセット。",
    "アタッカー自身のNP50%等は別行動として組み合わせる。",
  ],
};

export const SYSTEM_PRESETS: readonly SystemPreset[] = [
  SUMMER_SKADI_QUICK_PRESET,
  DOUBLE_KOYANSKAYA_BUSTER_PRESET,
];

export function presetById(id: string): SystemPreset | undefined {
  return SYSTEM_PRESETS.find((preset) => preset.id === id);
}

export function wavePlan(
  wave1: readonly string[] = [],
  wave2: readonly string[] = [],
  wave3: readonly string[] = [],
): readonly [readonly string[], readonly string[], readonly string[]] {
  return [wave1, wave2, wave3];
}

export const SYSTEM_WAVES: readonly SystemWave[] = [1, 2, 3];
