import type { ServantStatusRecord } from "../types/servant.js";
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
  return hidden ? { ...base, hidden } : base;
}
