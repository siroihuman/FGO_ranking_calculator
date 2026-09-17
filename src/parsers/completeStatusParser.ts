import type { ServantStatusRecord } from "../types/servant.js";
import { parseCommandCardCounts } from "./cardDeckParser.js";
import { parseHiddenStatusPage } from "./hiddenStatusParser.js";
import { parseNoblePhantasmPage } from "./noblePhantasmParser.js";
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
  let noblePhantasm: ServantStatusRecord["noblePhantasm"];
  try {
    noblePhantasm = parseNoblePhantasmPage(html, hidden?.noblePhantasmHits);
  } catch {
    // A missing/unknown NP table should not prevent status/normal-card rankings.
    noblePhantasm = undefined;
  }
  return {
    ...base,
    ...(hidden ? { hidden } : {}),
    cards,
    ...(noblePhantasm ? { noblePhantasm } : {}),
  };
}
