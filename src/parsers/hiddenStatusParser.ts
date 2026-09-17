import { load } from "cheerio";
import type { ServantHiddenStatusValues } from "../types/servant.js";
import { expandTableRows, normalizeCellText } from "./tableGrid.js";

function parseDecimal(value: string): number | undefined {
  const normalized = value.replace(/％/g, "%").replace(/,/g, "").trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseHits(value: string): number | undefined {
  const match = normalizeCellText(value).match(/(\d+)\s*(?:Hit|HIT|hit)?/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function valuesAfterLabel(row: string[], labels: readonly RegExp[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < row.length; index += 1) {
    const cell = normalizeCellText(row[index]);
    if (!labels.some((pattern) => pattern.test(cell))) continue;
    for (let cursor = index + 1; cursor < row.length; cursor += 1) {
      const candidate = normalizeCellText(row[cursor]);
      if (candidate) {
        values.push(candidate);
        break;
      }
    }
  }
  return values;
}

function firstParsedValue<T>(
  rows: string[][],
  labels: readonly RegExp[],
  parser: (value: string) => T | undefined,
): T | undefined {
  for (const row of rows) {
    for (const value of valuesAfterLabel(row, labels)) {
      const parsed = parser(value);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

export function parseHiddenStatusPage(html: string): ServantHiddenStatusValues | undefined {
  const $ = load(html);
  const candidateTables = $("table").toArray().filter((element) => {
    const text = normalizeCellText($(element).text());
    return /N\/A|N\/D|スター発生率|Quick|Arts|Buster|Extra|宝具/.test(text);
  });
  const rows = candidateTables.flatMap((element) => expandTableRows($, $(element)));
  if (rows.length === 0) return undefined;

  const result: ServantHiddenStatusValues = {
    npGainRate: firstParsedValue(rows, [/^N\/A$/i], parseDecimal),
    defenseNpRate: firstParsedValue(rows, [/^N\/D$/i], parseDecimal),
    starRate: firstParsedValue(rows, [/スター発生率/, /^SR$/i], parseDecimal),
    quickHits: firstParsedValue(rows, [/^Quick$/i, /^Q$/i], parseHits),
    artsHits: firstParsedValue(rows, [/^Arts$/i, /^A$/i], parseHits),
    busterHits: firstParsedValue(rows, [/^Buster$/i, /^B$/i], parseHits),
    extraHits: firstParsedValue(rows, [/^Extra$/i, /^EX$/i], parseHits),
    noblePhantasmHits: firstParsedValue(rows, [/^宝具$/, /宝具.*Hit/i], parseHits),
  };

  return Object.values(result).some((value) => value !== undefined) ? result : undefined;
}
