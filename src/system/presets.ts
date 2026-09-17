import type { CommandCardType } from "../types/servant.js";
import type {
  SystemActionDefinition,
  SystemWave,
} from "./actionSimulator.js";

export interface SystemSupportModifiers {
  attackModPermille?: number;
  cardPerformanceModPermille?: number;
  npDamageModPermille?: number;
  npGainModPermille?: number;
  /** Multiplies the full card-performance factor. 500 = x1.5. */
  cardPerformanceBoostPermille?: number;
  /** Multiplies NP-damage-up effects only. 1000 = x2. */
  npDamageBoostPermille?: number;
  overchargeStageIncrease?: number;
}

export interface SystemPreset {
  id: string;
  name: string;
  cardType: CommandCardType;
  initialNp: number;
  actions: readonly SystemActionDefinition[];
  defaultActionsByWave: readonly [readonly string[], readonly string[], readonly string[]];
  supportModifiersByWave?: readonly [
    SystemSupportModifiers,
    SystemSupportModifiers,
    SystemSupportModifiers,
  ];
  /** End-of-turn / recurring NP received after each Noble Phantasm. */
  postNoblePhantasmNpByWave?: readonly [number, number, number];
  notes?: readonly string[];
}

const THREE_WAVES = [1, 2, 3] as const;

const artsCastoriaBuffs = {
  attackModPermille: 400,
  cardPerformanceModPermille: 1000,
  npGainModPermille: 600,
} satisfies SystemSupportModifiers;

export const CASTORIA_ARTS_PRESET: SystemPreset = {
  id: "castoria-arts",
  name: "アルトリア〔キャスター〕・Arts",
  cardType: "arts",
  initialNp: 100,
  actions: [
    { id: "castoria-a-s2", label: "キャストリアA S2：NP20%", owner: "supportA", maxUses: 1, allowedWaves: THREE_WAVES, npGrant: 20 },
    { id: "castoria-b-s2", label: "キャストリアB S2：NP20%", owner: "supportB", maxUses: 1, allowedWaves: THREE_WAVES, npGrant: 20 },
  ],
  defaultActionsByWave: [[], [], []],
  supportModifiersByWave: [artsCastoriaBuffs, artsCastoriaBuffs, artsCastoriaBuffs],
  notes: ["既存ランキング基準：NP獲得量60%、Arts性能100%。", "ダメージ側では攻撃40%も同一プリセットから適用する。"],
};

const baphometArtsBuffs = {
  cardPerformanceModPermille: 1600,
  cardPerformanceBoostPermille: 500,
} satisfies SystemSupportModifiers;

export const BAPHOMET_ARTS_PRESET: SystemPreset = {
  id: "baphomet-arts",
  name: "バフォメット・Arts",
  cardType: "arts",
  initialNp: 100,
  actions: [
    { id: "baphomet-a-s2", label: "バフォメットA S2：NP30%", owner: "supportA", maxUses: 1, allowedWaves: THREE_WAVES, npGrant: 30 },
    { id: "baphomet-b-s2", label: "バフォメットB S2：NP30%", owner: "supportB", maxUses: 1, allowedWaves: THREE_WAVES, npGrant: 30 },
  ],
  defaultActionsByWave: [[], [], []],
  supportModifiersByWave: [baphometArtsBuffs, baphometArtsBuffs, baphometArtsBuffs],
  postNoblePhantasmNpByWave: [10, 10, 10],
  notes: ["既存ランキング基準：Arts性能160%、Arts性能ブースト50%。", "WバフォメットS2によるターン終了時NPを合計10%として扱う。"],
};

const summerSkadiBuffs = {
  attackModPermille: 400,
  cardPerformanceModPermille: 1300,
} satisfies SystemSupportModifiers;

/** Quick's standard loop: roughly 50% refund + 50% NP grant. */
export const SUMMER_SKADI_QUICK_PRESET: SystemPreset = {
  id: "summer-skadi-quick",
  name: "水着スカサハ＝スカディ・Quick",
  cardType: "quick",
  initialNp: 100,
  actions: [
    { id: "summer-skadi-a-np50", label: "水着スカディA：NP50%付与", owner: "supportA", maxUses: 1, allowedWaves: [2], npGrant: 50 },
    { id: "summer-skadi-b-np50", label: "水着スカディB：NP50%付与", owner: "supportB", maxUses: 1, allowedWaves: [3], npGrant: 50 },
  ],
  defaultActionsByWave: [[], ["summer-skadi-a-np50"], ["summer-skadi-b-np50"]],
  supportModifiersByWave: [summerSkadiBuffs, summerSkadiBuffs, summerSkadiBuffs],
  notes: ["Quick宝具の基本成立ラインは、宝具リチャージ約50%＋NP50%付与で次Wave100%到達。", "既存ダメージランキング基準：攻撃40%、Quick性能130%。"],
};

function dominationPreset(cthulhu: boolean): SystemPreset {
  const buffs = {
    attackModPermille: 400,
    cardPerformanceModPermille: 1000,
    npDamageModPermille: 400,
    overchargeStageIncrease: 4,
  } satisfies SystemSupportModifiers;
  return {
    id: cthulhu ? "domination-quick-cthulhu" : "domination-quick",
    name: cthulhu ? "支配のフォーリナー・Quick〔クトゥルフ〕" : "支配のフォーリナー・Quick",
    cardType: "quick",
    initialNp: 100,
    actions: [
      { id: "domination-a-s3", label: "支配A S3：NP50%", owner: "supportA", maxUses: 1, allowedWaves: THREE_WAVES, npGrant: 50 },
      { id: "domination-b-s3", label: "支配B S3：NP50%", owner: "supportB", maxUses: 1, allowedWaves: THREE_WAVES, npGrant: 50 },
    ],
    defaultActionsByWave: [[], [], []],
    supportModifiersByWave: [buffs, buffs, buffs],
    postNoblePhantasmNpByWave: cthulhu ? [30, 30, 30] : [15, 15, 15],
    notes: ["既存ランキング基準：Quick100%、毎ターンNP15%（クトゥルフなら30%）。", "ダメージ基準：攻撃40%、Quick100%、宝具40%、OC+4。"],
  };
}

export const DOMINATION_QUICK_PRESET = dominationPreset(false);
export const DOMINATION_QUICK_CTHULHU_PRESET = dominationPreset(true);

const koyanskayaBuffs = {
  cardPerformanceModPermille: 1000,
} satisfies SystemSupportModifiers;

export const DOUBLE_KOYANSKAYA_BUSTER_PRESET: SystemPreset = {
  id: "double-koyanskaya-buster",
  name: "光のコヤンスカヤ・Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [
    { id: "koyanskaya-a-s1", label: "光コヤンA S1", owner: "supportA", maxUses: 1, allowedWaves: [2], npGrant: 50, cooldownReduction: { targetOwner: "attacker", turns: 2 } },
    { id: "koyanskaya-b-s1", label: "光コヤンB S1", owner: "supportB", maxUses: 1, allowedWaves: [3], npGrant: 50, cooldownReduction: { targetOwner: "attacker", turns: 2 } },
  ],
  defaultActionsByWave: [[], ["koyanskaya-a-s1"], ["koyanskaya-b-s1"]],
  supportModifiersByWave: [koyanskayaBuffs, koyanskayaBuffs, koyanskayaBuffs],
  notes: ["2・3Waveで光コヤンS1を使用するNP/CT部分のプリセット。", "既存ダメージランキング基準：Buster性能100%。"],
};

const oberonWave3 = {
  cardPerformanceModPermille: 1000,
  npDamageModPermille: 300,
  npDamageBoostPermille: 1000,
} satisfies SystemSupportModifiers;

export const KOYANSKAYA_OBERON_BUSTER_PRESET: SystemPreset = {
  id: "koyanskaya-oberon-buster",
  name: "光コヤン＋オベロン・Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [
    { id: "koyanskaya-s1", label: "光コヤン S1", owner: "supportA", maxUses: 1, allowedWaves: [2], npGrant: 50, cooldownReduction: { targetOwner: "attacker", turns: 2 } },
    { id: "oberon-s1", label: "オベロン S1：NP20%", owner: "supportB", maxUses: 1, allowedWaves: [3], npGrant: 20 },
    { id: "oberon-s2", label: "オベロン S2：NP50%", owner: "supportB", maxUses: 1, allowedWaves: [3], npGrant: 50 },
  ],
  defaultActionsByWave: [[], ["koyanskaya-s1"], ["oberon-s1", "oberon-s2"]],
  supportModifiersByWave: [koyanskayaBuffs, koyanskayaBuffs, oberonWave3],
  notes: ["既存ランキング基準：Buster100%、3Waveに宝具30%＋宝具威力ブースト100%。"],
};

const luciferaBuffs = {
  attackModPermille: 400,
  cardPerformanceModPermille: 600,
} satisfies SystemSupportModifiers;

function luciferaSupportActions(prefix: "a" | "b", wave: 2 | 3): SystemActionDefinition[] {
  const owner = prefix === "a" ? "supportA" : "supportB";
  return [
    { id: `lucifera-${prefix}-s2`, label: `ルシフェラ${prefix.toUpperCase()} S2：NP50%`, owner, maxUses: 1, allowedWaves: [wave], npGrant: 50 },
    { id: `lucifera-${prefix}-s3`, label: `ルシフェラ${prefix.toUpperCase()} S3：現在NPを倍化`, owner, maxUses: 1, allowedWaves: [wave], npCurrentGainPermille: 1000, cooldownReduction: { targetOwner: "attacker", turns: 1 }, conditional: true },
  ];
}

export const LUCIFERA_BUSTER_PRESET: SystemPreset = {
  id: "lucifera-buster",
  name: "ルシフェラ・Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [...luciferaSupportActions("a", 2), ...luciferaSupportActions("b", 3)],
  defaultActionsByWave: [[], ["lucifera-a-s2", "lucifera-a-s3"], ["lucifera-b-s2", "lucifera-b-s3"]],
  supportModifiersByWave: [luciferaBuffs, luciferaBuffs, luciferaBuffs],
  notes: ["既存ランキング基準：攻撃40%、Buster60%。", "S3のNP倍化を現在NPに対する+100%として処理する。強化解除デメリット対策は条件扱い。"],
};

const luciferaOberonWave3 = {
  attackModPermille: 400,
  cardPerformanceModPermille: 600,
  npDamageModPermille: 300,
  npDamageBoostPermille: 1000,
} satisfies SystemSupportModifiers;

export const LUCIFERA_OBERON_BUSTER_PRESET: SystemPreset = {
  id: "lucifera-oberon-buster",
  name: "ルシフェラ＋オベロン・Buster",
  cardType: "buster",
  initialNp: 100,
  actions: [
    ...luciferaSupportActions("a", 2),
    { id: "lucifera-oberon-s1", label: "オベロン S1：NP20%", owner: "supportB", maxUses: 1, allowedWaves: [3], npGrant: 20 },
    { id: "lucifera-oberon-s2", label: "オベロン S2：NP50%", owner: "supportB", maxUses: 1, allowedWaves: [3], npGrant: 50 },
  ],
  defaultActionsByWave: [[], ["lucifera-a-s2", "lucifera-a-s3"], ["lucifera-oberon-s1", "lucifera-oberon-s2"]],
  supportModifiersByWave: [luciferaBuffs, luciferaBuffs, luciferaOberonWave3],
  notes: ["既存ランキング基準：攻撃40%、Buster60%、3Waveに宝具30%＋宝具威力ブースト100%。"],
};

export const SYSTEM_PRESETS: readonly SystemPreset[] = [
  CASTORIA_ARTS_PRESET,
  BAPHOMET_ARTS_PRESET,
  SUMMER_SKADI_QUICK_PRESET,
  DOMINATION_QUICK_PRESET,
  DOMINATION_QUICK_CTHULHU_PRESET,
  DOUBLE_KOYANSKAYA_BUSTER_PRESET,
  KOYANSKAYA_OBERON_BUSTER_PRESET,
  LUCIFERA_BUSTER_PRESET,
  LUCIFERA_OBERON_BUSTER_PRESET,
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
