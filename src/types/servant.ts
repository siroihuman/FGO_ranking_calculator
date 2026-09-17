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
}
