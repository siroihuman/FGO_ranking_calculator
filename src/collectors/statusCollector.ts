import { RANKING_SOURCES } from "../config/sources.js";
import type { ServantStatusRecord } from "../types/servant.js";
import {
  parseOfficialServantList,
  parseOriginalServantList,
  type ServantPageLink,
} from "./listCollector.js";
import { fetchPageHtml, type FetchPageOptions } from "./pageFetcher.js";
import { parseServantStatusPage } from "../parsers/statusParser.js";

export interface StatusCollectionError {
  source: ServantPageLink["source"];
  name: string;
  pageId: string;
  pageUrl: string;
  message: string;
}

export interface StatusCollectionResult {
  records: ServantStatusRecord[];
  errors: StatusCollectionError[];
  links: ServantPageLink[];
}

export interface CollectStatusOptions extends FetchPageOptions {
  concurrency?: number;
  perSourceLimit?: number;
}

async function collectLinks(options: FetchPageOptions): Promise<ServantPageLink[]> {
  const [officialHtml, originalHtml] = await Promise.all([
    fetchPageHtml(RANKING_SOURCES.official.listUrl, options),
    fetchPageHtml(RANKING_SOURCES.original.listUrl, options),
  ]);
  return [
    ...parseOfficialServantList(officialHtml, RANKING_SOURCES.official.listUrl),
    ...parseOriginalServantList(originalHtml, RANKING_SOURCES.original.listUrl),
  ];
}

function applyPerSourceLimit(
  links: ServantPageLink[],
  limit: number | undefined,
): ServantPageLink[] {
  if (!limit || limit <= 0) return links;
  const count = { official: 0, original: 0 };
  return links.filter((link) => {
    if (count[link.source] >= limit) return false;
    count[link.source] += 1;
    return true;
  });
}

export async function collectStatusData(
  options: CollectStatusOptions = {},
): Promise<StatusCollectionResult> {
  const allLinks = await collectLinks(options);
  const links = applyPerSourceLimit(allLinks, options.perSourceLimit);
  const records: ServantStatusRecord[] = [];
  const errors: StatusCollectionError[] = [];
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 8));

  async function worker(): Promise<void> {
    while (cursor < links.length) {
      const index = cursor;
      cursor += 1;
      const link = links[index];
      try {
        const html = await fetchPageHtml(link.pageUrl, options);
        records.push(parseServantStatusPage(html, {
          source: link.source,
          pageId: link.pageId,
          pageUrl: link.pageUrl,
          nameHint: link.name,
        }));
      } catch (error) {
        errors.push({
          ...link,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  records.sort((left, right) =>
    left.source.localeCompare(right.source)
    || left.no.localeCompare(right.no, "ja", { numeric: true })
    || left.name.localeCompare(right.name, "ja"),
  );
  errors.sort((left, right) =>
    left.source.localeCompare(right.source)
    || left.pageId.localeCompare(right.pageId, "ja", { numeric: true }),
  );

  return { records, errors, links };
}
