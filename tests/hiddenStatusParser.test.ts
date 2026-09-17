import { describe, expect, it } from "vitest";
import { parseHiddenStatusPage } from "../src/parsers/hiddenStatusParser.js";

describe("parseHiddenStatusPage", () => {
  it("parses N/A, N/D, star rate and hit counts", () => {
    const html = `
      <table>
        <tr><th>スター発生率</th><td>8.1</td><th>N/A</th><td>0.43</td><th>N/D</th><td>3.00</td></tr>
        <tr><th>Quick</th><td>5 Hit</td><th>Arts</th><td>4 Hit</td><th>Buster</th><td>4 Hit</td></tr>
        <tr><th>Extra</th><td>5 Hit</td><th>宝具</th><td>9 Hit</td></tr>
      </table>
    `;

    expect(parseHiddenStatusPage(html)).toEqual({
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

  it("returns undefined when no hidden status fields are present", () => {
    expect(parseHiddenStatusPage("<table><tr><td>HP</td><td>10000</td></tr></table>"))
      .toBeUndefined();
  });
});
