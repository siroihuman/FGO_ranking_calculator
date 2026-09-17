import { load } from "cheerio";
import type { ServantSource } from "../types/servant.js";
import { normalizeCellText } from "../parsers/tableGrid.js";

export interface ServantPageLink {
  source: ServantSource;
  name: string;
  pageId: string;
  pageUrl: string;
}

const PAGE_PATH = /^\/(f_go|siroi_human)\/pages\/(\d+)\.html$/;

function normalizePageLink(
  source: ServantSource,
  href: string,
  name: string,
  baseUrl: string,
): ServantPageLink | null {
  const trimmedName = normalizeCellText(name);
  if (!trimmedName || trimmedName === "Image") return null;

  let url: URL;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }

  const match = url.pathname.match(PAGE_PATH);
  if (!match) return null;
  if (source === "official" && match[1] !== "f_go") return null;
  if (source === "original" && match[1] !== "siroi_human") return null;

  return {
    source,
    name: trimmedName,
    pageId: match[2],
    pageUrl: `${url.origin}${url.pathname}`,
  };
}

function dedupeLinks(links: ServantPageLink[]): ServantPageLink[] {
  const byPageId = new Map<string, ServantPageLink>();
  for (const link of links) {
    if (!byPageId.has(link.pageId)) byPageId.set(link.pageId, link);
  }
  return [...byPageId.values()];
}

export function parseOriginalServantList(
  html: string,
  baseUrl = "https://w.atwiki.jp/siroi_human/pages/54.html",
): ServantPageLink[] {
  const $ = load(html);
  const heading = $("h3")
    .filter((_, element) => normalizeCellText($(element).text()) === "サーヴァント")
    .first();
  if (heading.length === 0) {
    throw new Error("original servant list: サーヴァント heading not found");
  }

  const links: ServantPageLink[] = [];
  heading.nextUntil("h3").find("a[href]").each((_, anchor) => {
    const element = $(anchor);
    const parsed = normalizePageLink(
      "original",
      element.attr("href") ?? "",
      element.text(),
      baseUrl,
    );
    if (parsed) links.push(parsed);
  });
  return dedupeLinks(links);
}

export function parseOfficialServantList(
  html: string,
  baseUrl = "https://w.atwiki.jp/f_go/pages/671.html",
): ServantPageLink[] {
  const $ = load(html);
  const tables = $("table").toArray();
  let bestTableIndex = -1;
  let bestCount = 0;

  tables.forEach((table, tableIndex) => {
    const current = $(table);
    const text = normalizeCellText(current.text());
    if (
      !text.includes("C★")
      || !text.includes("UC★★")
      || !text.includes("R★★★")
      || !text.includes("SR★★★★")
      || !text.includes("SSR★★★★★")
    ) {
      return;
    }

    const pageIds = new Set<string>();
    current.find("a[href]").each((_, anchor) => {
      const element = $(anchor);
      const parsed = normalizePageLink(
        "official",
        element.attr("href") ?? "",
        element.text(),
        baseUrl,
      );
      if (parsed) pageIds.add(parsed.pageId);
    });

    if (pageIds.size > bestCount) {
      bestTableIndex = tableIndex;
      bestCount = pageIds.size;
    }
  });

  if (bestTableIndex < 0 || bestCount === 0) {
    throw new Error("official servant list table not found");
  }

  const bestTable = $(tables[bestTableIndex]);
  const links: ServantPageLink[] = [];
  bestTable.find("a[href]").each((_, anchor) => {
    const element = $(anchor);
    const parsed = normalizePageLink(
      "official",
      element.attr("href") ?? "",
      element.text(),
      baseUrl,
    );
    if (parsed) links.push(parsed);
  });
  return dedupeLinks(links);
}
