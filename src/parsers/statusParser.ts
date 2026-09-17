import { load } from "cheerio";
import type {
  ServantClass,
  ServantSource,
  ServantStatusRecord,
} from "../types/servant.js";
import { expandTableRows, normalizeCellText } from "./tableGrid.js";

export interface StatusPageIdentity {
  source: ServantSource;
  pageId: string;
  pageUrl: string;
  nameHint?: string;
}

const DEFAULT_MAX_LEVEL: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 60,
  2: 65,
  3: 70,
  4: 80,
  5: 90,
};

const CLASS_ALIASES: Array<[RegExp, ServantClass]> = [
  [/セイバー|^剣$/, "Saber"],
  [/アーチャー|^弓$/, "Archer"],
  [/ランサー|^槍$/, "Lancer"],
  [/ライダー|^騎$/, "Rider"],
  [/キャスター|^術$/, "Caster"],
  [/アサシン|^殺$/, "Assassin"],
  [/バーサーカー|^狂$/, "Berserker"],
  [/シールダー|^盾$/, "Shielder"],
  [/ルーラー|^裁$/, "Ruler"],
  [/アヴェンジャー|^讐$/, "Avenger"],
  [/ムーンキャンサー|^月$/, "MoonCancer"],
  [/アルターエゴ|^分$/, "AlterEgo"],
  [/フォーリナー|^降$/, "Foreigner"],
  [/プリテンダー|^詐$/, "Pretender"],
  [/ビースト|^獣$/, "Beast"],
];

function classFromText(value: string): ServantClass {
  const normalized = normalizeCellText(value);
  return CLASS_ALIASES.find(([pattern]) => pattern.test(normalized))?.[1] ?? "Other";
}

function parseInteger(value: string): number | undefined {
  const normalized = value.replace(/[,，]/g, "").trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const result = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(result) ? result : undefined;
}

function valueAfterLabel(cells: string[], label: string): string | undefined {
  const index = cells.findIndex((cell) => normalizeCellText(cell) === label);
  if (index < 0) return undefined;
  for (let cursor = index + 1; cursor < cells.length; cursor += 1) {
    const value = normalizeCellText(cells[cursor]);
    if (value && value !== label) return value;
  }
  return undefined;
}

function findBasicTable(html: string) {
  const $ = load(html);
  const tables = $("table").toArray();
  let bestTableIndex = -1;
  let bestScore = 0;

  tables.forEach((element, tableIndex) => {
    const table = $(element);
    const text = normalizeCellText(table.text());
    let score = 0;
    if (text.includes("真名")) score += 2;
    if (text.includes("Class")) score += 2;
    if (text.includes("Rare")) score += 2;
    if (text.includes("能力値")) score += 2;
    if (text.includes("HP")) score += 1;
    if (text.includes("ATK")) score += 1;
    if (text.includes("Lv.")) score += 1;
    if (score > bestScore) {
      bestTableIndex = tableIndex;
      bestScore = score;
    }
  });

  if (bestTableIndex < 0 || bestScore < 8) {
    throw new Error("basic servant status table not found");
  }
  return { $, table: $(tables[bestTableIndex]) };
}

function levelColumns(header: string[]): Map<number, number> {
  const result = new Map<number, number>();
  header.forEach((cell, index) => {
    const match = normalizeCellText(cell).match(/^Lv\.\s*(\d+)$/i);
    if (match) result.set(Number.parseInt(match[1], 10), index);
  });
  return result;
}

function rowByLabel(rows: string[][], label: string): string[] {
  const row = rows.find((candidate) =>
    candidate.some((cell) => normalizeCellText(cell) === label),
  );
  if (!row) throw new Error(`${label} row not found in basic status table`);
  return row;
}

function valueAtLevel(
  row: string[],
  columns: Map<number, number>,
  level: number,
): number | undefined {
  const index = columns.get(level);
  return index === undefined ? undefined : parseInteger(row[index] ?? "");
}

function numericValuesAfterLabel(row: string[], label: string): number[] {
  const index = row.findIndex((cell) => normalizeCellText(cell) === label);
  if (index < 0) return [];
  return row
    .slice(index + 1)
    .map(parseInteger)
    .filter((value): value is number => value !== undefined);
}

function parseRarity(value: string | undefined): 1 | 2 | 3 | 4 | 5 {
  const rarity = value ? parseInteger(value) : undefined;
  if (rarity && rarity >= 1 && rarity <= 5) {
    return rarity as 1 | 2 | 3 | 4 | 5;
  }
  throw new Error(`unsupported or missing rarity: ${value ?? "(missing)"}`);
}

export function parseServantStatusPage(
  html: string,
  identity: StatusPageIdentity,
): ServantStatusRecord {
  const { $, table } = findBasicTable(html);
  const rows = expandTableRows($, table);
  const flattened = rows.flat();
  const tableText = normalizeCellText(table.text());

  const noMatch = tableText.match(/No\.\s*([0-9]+(?:')?)/i)
    ?? normalizeCellText($("body").text()).match(/No\.\s*([0-9]+(?:')?)/i);
  if (!noMatch) throw new Error("servant No. not found");

  const rarity = parseRarity(valueAfterLabel(flattened, "Rare"));
  const defaultMaxLevel = DEFAULT_MAX_LEVEL[rarity];
  const classText = valueAfterLabel(flattened, "Class");
  if (!classText) throw new Error("servant class not found");

  const header = rows.find((row) =>
    row.some((cell) => normalizeCellText(cell) === "能力値")
    && row.some((cell) => /^Lv\./i.test(normalizeCellText(cell))),
  );
  if (!header) throw new Error("status level header not found");

  const columns = levelColumns(header);
  const hpRow = rowByLabel(rows, "HP");
  const atkRow = rowByLabel(rows, "ATK");
  const hpFallback = numericValuesAfterLabel(hpRow, "HP");
  const atkFallback = numericValuesAfterLabel(atkRow, "ATK");

  const hpMax = valueAtLevel(hpRow, columns, defaultMaxLevel)
    ?? hpFallback.at(-1);
  const atkMax = valueAtLevel(atkRow, columns, defaultMaxLevel)
    ?? atkFallback.at(-1);
  if (hpMax === undefined || atkMax === undefined) {
    throw new Error("maximum HP/ATK values not found");
  }

  const parsedName = valueAfterLabel(flattened, "真名");
  const name = parsedName || identity.nameHint;
  if (!name) throw new Error("servant name not found");

  return {
    id: `${identity.source}:${identity.pageId}`,
    source: identity.source,
    pageUrl: identity.pageUrl,
    pageId: identity.pageId,
    no: noMatch[1],
    name,
    className: classFromText(classText),
    rarity,
    status: {
      maxLevel: defaultMaxLevel,
      hpMax,
      atkMax,
      hp100: valueAtLevel(hpRow, columns, 100),
      atk100: valueAtLevel(atkRow, columns, 100),
      hp120: valueAtLevel(hpRow, columns, 120),
      atk120: valueAtLevel(atkRow, columns, 120),
    },
  };
}
