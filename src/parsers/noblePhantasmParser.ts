import { load } from "cheerio";
import type { CommandCardType, NoblePhantasmData, NoblePhantasmEffectRow } from "../types/servant.js";
import { expandTableRows, normalizeCellText } from "./tableGrid.js";

function cardTypeFromText(text: string): CommandCardType | undefined {
  const normalized = normalizeCellText(text).toLowerCase();
  if (normalized.includes("buster")) return "buster";
  if (normalized.includes("arts")) return "arts";
  if (normalized.includes("quick")) return "quick";
  return undefined;
}

function parseNumber(text: string): number | undefined {
  const normalized = normalizeCellText(text).replace(/[,，]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function findNoblePhantasmTable(html: string) {
  const $ = load(html);
  const headings = $("h2,h3,h4,h5").toArray();
  const heading = headings.find((element) => normalizeCellText($(element).text()) === "宝具");
  if (!heading) throw new Error("noble phantasm heading not found");

  let cursor = $(heading).next();
  while (cursor.length > 0 && !cursor.is("h2,h3,h4,h5")) {
    if (cursor.is("table")) return { $, table: cursor };
    const nested = cursor.find("table").first();
    if (nested.length > 0) return { $, table: nested };
    cursor = cursor.next();
  }
  throw new Error("noble phantasm table not found");
}

function targetScopeFromAttackText(text: string): NoblePhantasmData["targetScope"] {
  if (/敵(?:全体|全体の)/.test(text)) return "all";
  if (/敵(?:単体|単体の|一体)/.test(text)) return "single";
  return "support";
}

function damageValues(values: number[]): [number, number, number, number, number] | undefined {
  if (values.length < 5) return undefined;
  const lastFive = values.slice(-5).map((value) => Math.round(value * 10));
  return lastFive as [number, number, number, number, number];
}

export function parseNoblePhantasmPage(html: string, hitCount?: number): NoblePhantasmData {
  const { $, table } = findNoblePhantasmTable(html);
  const rows = expandTableRows($, table);
  const flattenedText = normalizeCellText(table.text());
  const cardType = cardTypeFromText(flattenedText);
  if (!cardType) throw new Error("noble phantasm card type not found");

  const dataRows = rows.filter((row) => {
    const text = normalizeCellText(row.join(" "));
    return text.length > 0 && !/^Card\b/i.test(text) && !/ランク.*種別.*効果/.test(text);
  });

  let attackIndex = -1;
  for (let index = 0; index < dataRows.length; index += 1) {
    const text = normalizeCellText(dataRows[index].join(" "));
    if (/強力な攻撃|超強力な攻撃|攻撃\[Lv\]|ダメージを与える/.test(text)) {
      attackIndex = index;
      break;
    }
  }

  const effectRows: NoblePhantasmEffectRow[] = dataRows.map((row, index) => {
    const rawText = normalizeCellText(row.join(" "));
    const values = row.map(parseNumber).filter((value): value is number => value !== undefined);
    const phase: NoblePhantasmEffectRow["phase"] = attackIndex < 0
      ? "before_attack"
      : index < attackIndex
        ? "before_attack"
        : index === attackIndex
          ? "attack"
          : "after_attack";
    return { rawText, values, phase };
  });

  const attackRow = attackIndex >= 0 ? effectRows[attackIndex] : undefined;
  const targetScope = attackRow ? targetScopeFromAttackText(attackRow.rawText) : "support";

  let name: string | undefined;
  const heading = $("h2,h3,h4,h5").toArray().find((element) => normalizeCellText($(element).text()) === "宝具");
  if (heading) {
    let cursor = $(heading).next();
    const names: string[] = [];
    while (cursor.length > 0 && !cursor.is("table,h2,h3,h4,h5")) {
      const text = normalizeCellText(cursor.text());
      if (text) names.push(text);
      cursor = cursor.next();
    }
    name = names.at(-1);
  }

  return {
    name,
    cardType,
    targetScope,
    hitCount,
    damageMultiplierPermilleByLevel: attackRow ? damageValues(attackRow.values) : undefined,
    effectRows,
  };
}
