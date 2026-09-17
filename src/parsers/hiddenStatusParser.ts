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

function valueAfterLabel(row: string[], labels: readonly RegExp[]): string | undefined {
  for (let index = 0; index < row.length; index += 1) {
    const cell = normalizeCellText(row[index]);
    if (!labels.some((pattern) => pattern.test(cell))) continue;
    for (let cursor = index + 1; cursor < row.length; cursor += 1) {
      const candidate = normalizeCellText(row[cursor]);
      if (candidate) return candidate;
    }
  }
  return undefined;
}

function firstValue(rows: string[][], labels: readonly RegExp[]): string | undefined {
  for (const row of rows) {
    const value = valueAfterLabel(row, labels);
    if (value !== undefined) return value;
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
    npGainRate: parseDecimal(firstValue(rows, [/^N\/A$/i]) ?? ""),
    defenseNpRate: parseDecimal(firstValue(rows, [/^N\/D$/i]) ?? ""),
    starRate: parseDecimal(firstValue(rows, [/スター発生率/, /^SR$/i]) ?? ""),
    quickHits: parseHits(firstValue(rows, [/^Quick$/i, /^Q$/i]) ?? ""),
    artsHits: parseHits(firstValue(rows, [/^Arts$/i, /^A$/i]) ?? ""),
    busterHits: parseHits(firstValue(rows, [/^Buster$/i, /^B$/i]) ?? ""),
    extraHits: parseHits(firstValue(rows, [/^Extra$/i, /^EX$/i]) ?? ""),
    noblePhantasmHits: parseHits(firstValue(rows, [/^宝具$/, /宝具.*Hit/i]) ?? ""),
  };

  return Object.values(result).some((value) => value !== undefined) ? result : undefined;
}
