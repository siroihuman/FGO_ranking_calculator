import { describe, expect, it } from "vitest";
import { parseCommandCardCounts } from "../src/parsers/cardDeckParser.js";

describe("parseCommandCardCounts", () => {
  it("reads Quick/Arts/Buster counts from the basic status table", () => {
    const html = `
      <table>
        <tr><th>真名</th><td>李広</td><th>Class</th><td>アーチャー</td><th>Rare</th><td>5</td></tr>
        <tr><th>Quick</th><th>Arts</th><th>Buster</th><th>能力値</th><th>Lv. 1</th><th>Lv.90</th></tr>
        <tr><td>2</td><td>2</td><td>1</td><th>HP</th><td>2048</td><td>13965</td></tr>
        <tr><td></td><td></td><td></td><th>ATK</th><td>1838</td><td>11898</td></tr>
      </table>
    `;
    expect(parseCommandCardCounts(html)).toEqual({ quick: 2, arts: 2, buster: 1 });
  });
});
