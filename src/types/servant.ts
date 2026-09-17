export type ServantSource = "official" | "original";

export type ServantClass =
  | "Saber"
  | "Archer"
  | "Lancer"
  | "Rider"
  | "Caster"
  | "Assassin"
  | "Berserker"
  | "Ruler"
  | "Avenger"
  | "MoonCancer"
  | "AlterEgo"
  | "Foreigner"
  | "Pretender"
  | "Shielder"
  | "Beast"
  | "Other";

export interface ServantStatusValues {
  maxLevel: number;
  hpMax: number;
  atkMax: number;
  hp100?: number;
  atk100?: number;
  hp120?: number;
  atk120?: number;
}

export interface ServantHiddenStatusValues {
  /** Base NP gain rate (N/A), stored as the source decimal value such as 0.43. */
  npGainRate?: number;
  /** Base defensive NP gain rate (N/D), stored as the source decimal value such as 3.00. */
  defenseNpRate?: number;
  /** Servant star generation rate in percent, such as 8.1 for 8.1%. */
  starRate?: number;
  quickHits?: number;
  artsHits?: number;
  busterHits?: number;
  extraHits?: number;
  noblePhantasmHits?: number;
}

export interface ServantStatusRecord {
  id: string;
  source: ServantSource;
  pageUrl: string;
  pageId: string;
  no: string;
  name: string;
  className: ServantClass;
  rarity: 1 | 2 | 3 | 4 | 5;
  status: ServantStatusValues;
  hidden?: ServantHiddenStatusValues;
}
