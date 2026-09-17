import type { Cheerio, CheerioAPI } from "cheerio";

export function normalizeCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function expandTableRow($: CheerioAPI, row: Cheerio<any>): string[] {
  const cells: string[] = [];
  row.children("th, td").each((_, cell) => {
    const element = $(cell);
    const text = normalizeCellText(element.text());
    const rawColspan = Number.parseInt(element.attr("colspan") ?? "1", 10);
    const colspan = Number.isFinite(rawColspan) && rawColspan > 0 ? rawColspan : 1;
    for (let index = 0; index < colspan; index += 1) {
      cells.push(text);
    }
  });
  return cells;
}

export function expandTableRows($: CheerioAPI, table: Cheerio<any>): string[][] {
  const rows: string[][] = [];
  table.find("tr").each((_, row) => {
    const expanded = expandTableRow($, $(row));
    if (expanded.length > 0) rows.push(expanded);
  });
  return rows;
}
