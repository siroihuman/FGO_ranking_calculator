import { describe, expect, it } from "vitest";
import { parseServantCompleteStatusPage } from "../src/parsers/completeStatusParser.js";

describe("parseServantCompleteStatusPage", () => {
  it("combines status, hidden values and command card counts", () => {
    const html = `
      <table>
        <tr><td>No.105</td></tr>
        <tr><th>真名</th><td>李広</td><th>Class</th><td>アーチャー</td><th>Rare</th><td>5</td></tr>
        <tr><th>Quick</th><th>Arts</th><th>Buster</th><th>能力値</th><th>Lv. 1</th><th>Lv.90</th></tr>
        <tr><td>2</td><td>2</td><td>1</td><th>HP</th><td>2048</td><td>13965</td></tr>
        <tr><td></td><td></td><td></td><th>ATK</th><td>1838</td><td>11898</td></tr>
      </table>
      <table>
        <tr><th>N/A</th><td>0.43</td><th>N/D</th><td>3.00</td><th>スター発生率</th><td>8.1</td></tr>
        <tr><th>Quick</th><td>5</td><th>Arts</th><td>4</td><th>Buster</th><td>4</td><th>EX</th><td>5</td><th>宝具</th><td>9</td></tr>
      </table>
    `;
    const parsed = parseServantCompleteStatusPage(html, {
      source: "original",
      pageId: "915",
      pageUrl: "https://w.atwiki.jp/siroi_human/pages/915.html",
    });
    expect(parsed.cards).toEqual({ quick: 2, arts: 2, buster: 1 });
    expect(parsed.hidden).toMatchObject({
      npGainRate: 0.43,
      defenseNpRate: 3,
      starRate: 8.1,
      quickHits: 5,
      artsHits: 4,
      busterHits: 4,
      extraHits: 5,
      noblePhantasmHits: 9,
    });
  });
});
