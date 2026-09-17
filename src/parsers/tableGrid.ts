import type { Cheerio, Element } from "cheerio";

export function normalizeCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function expandTableRow(row: Cheerio<Element>): string[] {
  const cells: string[] = [];
  row.find(":scope > th, :scope > td").each((_, cell) => {
    const element = row._make(cell);
    const text = normalizeCellText(element.text());
    const rawColspan = Number.parseInt(element.attr("colspan") ?? "1", 10);
    const colspan = Number.isFinite(rawColspan) && rawColspan > 0 ? rawColspan : 1;
    for (let index = 0; index < colspan; index += 1) {
      cells.push(text);
    }
  });
  return cells;
}

export function expandTableRows(table: Cheerio<Element>): string[][] {
  const rows: string[][] = [];
  table.find("tr").each((_, row) => {
    const expanded = expandTableRow(table._make(row));
    if (expanded.length > 0) rows.push(expanded);
  });
  return rows;
}
