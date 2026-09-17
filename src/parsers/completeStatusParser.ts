import type { ServantStatusRecord } from "../types/servant.js";
import { parseCommandCardCounts } from "./cardDeckParser.js";
import { parseHiddenStatusPage } from "./hiddenStatusParser.js";
import {
  parseServantStatusPage,
  type StatusPageIdentity,
} from "./statusParser.js";

export function parseServantCompleteStatusPage(
  html: string,
  identity: StatusPageIdentity,
): ServantStatusRecord {
  const base = parseServantStatusPage(html, identity);
  const hidden = parseHiddenStatusPage(html);
  const cards = parseCommandCardCounts(html);
  return {
    ...base,
    ...(hidden ? { hidden } : {}),
    cards,
  };
}
