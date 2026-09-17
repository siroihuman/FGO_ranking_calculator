import { load } from "cheerio";
import type { ServantCommandCardCounts } from "../types/servant.js";
import { expandTableRows, normalizeCellText } from "./tableGrid.js";

function parseCount(value: string): number | undefined {
  const normalized = normalizeCellText(value);
  if (!/^\d+$/.test(normalized)) return undefined;
  const count = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(count) ? count : undefined;
}

export function parseCommandCardCounts(html: string): ServantCommandCardCounts {
  const $ = load(html);
  for (const element of $("table").toArray()) {
    const rows = expandTableRows($, $(element));
    for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
      const row = rows[rowIndex].map(normalizeCellText);
      const quickIndex = row.findIndex((cell) => cell === "Quick");
      const artsIndex = row.findIndex((cell) => cell === "Arts");
      const busterIndex = row.findIndex((cell) => cell === "Buster");
      if (quickIndex < 0 || artsIndex < 0 || busterIndex < 0) continue;
      const values = rows[rowIndex + 1];
      const quick = parseCount(values[quickIndex] ?? "");
      const arts = parseCount(values[artsIndex] ?? "");
      const buster = parseCount(values[busterIndex] ?? "");
      if (quick === undefined || arts === undefined || buster === undefined) continue;
      if (quick + arts + buster !== 5) continue;
      return { quick, arts, buster };
    }
  }
  throw new Error("command card counts not found");
}
