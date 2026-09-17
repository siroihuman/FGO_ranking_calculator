import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { normalizeRankingEffect } from "../effects/normalizeEffect.js";
import type {
  NormalizedRankingEffect,
  RankingEffectTarget,
  ServantClassSkillData,
  ServantSkillData,
} from "../effects/types.js";
import { expandTableRows, normalizeCellText } from "./tableGrid.js";

function parseNumber(text: string): number | undefined {
  const normalized = normalizeCellText(text).replace(/[,，％%]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function findSectionHeading($: CheerioAPI, label: string) {
  return $("h2,h3,h4").toArray().find((element) =>
    normalizeCellText($(element).text()) === label,
  );
}

function firstTableAfter($: CheerioAPI, heading: any) {
  let cursor = $(heading).next();
  while (cursor.length > 0 && !cursor.is("h3,h4")) {
    if (cursor.is("table")) return cursor;
    const nested = cursor.find("table").first();
    if (nested.length > 0) return nested;
    cursor = cursor.next();
  }
  return undefined;
}

function sectionTables($: CheerioAPI, heading: any) {
  const tables: ReturnType<CheerioAPI>[] = [];
  let cursor = $(heading).next();
  while (cursor.length > 0 && !cursor.is("h2,h3")) {
    if (cursor.is("table")) {
      tables.push(cursor as ReturnType<CheerioAPI>);
    } else {
      cursor.find("table").each((_, table) => {
        tables.push($(table) as ReturnType<CheerioAPI>);
      });
    }
    cursor = cursor.next();
  }
  return tables;
}

function looksLikeEffect(text: string): boolean {
  return /(?:自身|味方|敵|NP|スター|攻撃力|防御力|カード|宝具威力|クリティカル|必中|特攻|与ダメージ)/.test(text)
    && text !== "効果";
}

function effectCell(row: string[]): { index: number; text: string } | undefined {
  for (let index = 0; index < row.length; index += 1) {
    const text = normalizeCellText(row[index] ?? "");
    if (looksLikeEffect(text)) return { index, text };
  }
  return undefined;
}

function lastNumericAfter(row: string[], index: number): number | undefined {
  const values = row.slice(index + 1)
    .map(parseNumber)
    .filter((value): value is number => value !== undefined);
  return values.at(-1);
}

function ctBeforeEffect(row: string[], index: number): number | undefined {
  const values = row.slice(0, index)
    .map(parseNumber)
    .filter((value): value is number =>
      value !== undefined && Number.isInteger(value) && value > 0 && value <= 20,
    );
  return values.at(-1);
}

function isStandaloneCondition(text: string): boolean {
  return /^[<＜].*[>＞]$/.test(text) || /場合のみ使用可能/.test(text);
}

function parseEffects(
  rows: string[][],
  initialCondition?: string,
): { effects: NormalizedRankingEffect[]; ct?: number } {
  const effects: NormalizedRankingEffect[] = [];
  let previousTarget: RankingEffectTarget | undefined;
  let pendingCondition = initialCondition;
  let ct: number | undefined;

  for (const row of rows) {
    const located = effectCell(row);
    if (!located) continue;
    if (ct === undefined) ct = ctBeforeEffect(row, located.index);
    if (isStandaloneCondition(located.text)) {
      pendingCondition = located.text.replace(/^[<＜]|[>＞]$/g, "").trim();
      continue;
    }
    const normalized = normalizeRankingEffect(
      located.text,
      lastNumericAfter(row, located.index),
      previousTarget,
      pendingCondition,
    );
    effects.push(normalized);
    if (normalized.target !== "unknown") previousTarget = normalized.target;
    pendingCondition = undefined;
  }

  return { effects, ...(ct !== undefined ? { ct } : {}) };
}

function skillHeading(text: string): {
  slot: 1 | 2 | 3;
  name: string;
  strengthened: boolean;
} | undefined {
  const match = normalizeCellText(text).match(/^Skill([123])(\[強化後\])?[：:]\s*(.+)$/);
  if (!match) return undefined;
  return {
    slot: Number(match[1]) as 1 | 2 | 3,
    name: match[3].trim(),
    strengthened: Boolean(match[2]),
  };
}

function parseServantSkills($: CheerioAPI): ServantSkillData[] {
  const section = findSectionHeading($, "保有スキル");
  if (!section) return [];
  const skills: ServantSkillData[] = [];
  let cursor = $(section).next();
  while (cursor.length > 0 && !cursor.is("h2,h3")) {
    if (cursor.is("h4")) {
      const heading = skillHeading(cursor.text());
      if (heading) {
        const table = firstTableAfter($, cursor[0]);
        if (table) {
          const parsed = parseEffects(expandTableRows($, table));
          skills.push({
            ...heading,
            ...(parsed.ct !== undefined ? { ct: parsed.ct } : {}),
            effects: parsed.effects,
          });
        }
      }
    }
    cursor = cursor.next();
  }
  return skills;
}

function classSkillName(rows: string[][]): string {
  for (const row of rows) {
    for (const cell of row) {
      const text = normalizeCellText(cell);
      if (!text || looksLikeEffect(text) || /^\d+(?:[,，].*)?$/.test(text)) continue;
      if (/^(CT|効果|Lv\.)/.test(text)) continue;
      return text;
    }
  }
  return "クラススキル";
}

function parseClassSkills($: CheerioAPI): ServantClassSkillData[] {
  const section = findSectionHeading($, "クラススキル");
  if (!section) return [];
  return sectionTables($, section).flatMap((table) => {
    const rows = expandTableRows($, table);
    const parsed = parseEffects(rows);
    if (parsed.effects.length === 0) return [];
    return [{ name: classSkillName(rows), effects: parsed.effects }];
  });
}

export function parseSkillDataPage(html: string): {
  skills: ServantSkillData[];
  classSkills: ServantClassSkillData[];
} {
  const $ = load(html);
  return {
    skills: parseServantSkills($),
    classSkills: parseClassSkills($),
  };
}
