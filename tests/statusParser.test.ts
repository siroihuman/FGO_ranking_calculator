import { describe, expect, it } from "vitest";
import { parseServantStatusPage } from "../src/parsers/statusParser.js";

describe("parseServantStatusPage", () => {
  it("parses original pages with explicit Lv100 and Lv120 columns", () => {
    const html = `
      <table>
        <tr><td colspan="14">No.105</td></tr>
        <tr><th>真名</th><td>李広</td><th>Class</th><td>アーチャー</td><th>Rare</th><td>5</td><th>Cost</th><td>16</td></tr>
        <tr>
          <th colspan="3">コマンドカード</th><th>能力値</th>
          <th>Lv. 1</th><th>Lv.50</th><th>Lv.60</th><th>Lv.70</th><th>Lv.80</th><th>Lv.90</th><th>Lv.100</th><th>Lv.120</th>
        </tr>
        <tr><td>Quick</td><td>Arts</td><td>Buster</td><th>HP</th><td>2048</td><td>8518</td><td>9915</td><td>11172</td><td>12568</td><td>13965</td><td>15299</td><td>17981</td></tr>
        <tr><td>2</td><td>2</td><td>1</td><th>ATK</th><td>1838</td><td>7257</td><td>8447</td><td>9518</td><td>10708</td><td>11898</td><td>13024</td><td>15288</td></tr>
      </table>
    `;

    expect(parseServantStatusPage(html, {
      source: "original",
      pageId: "915",
      pageUrl: "https://w.atwiki.jp/siroi_human/pages/915.html",
    })).toEqual({
      id: "original:915",
      source: "original",
      pageUrl: "https://w.atwiki.jp/siroi_human/pages/915.html",
      pageId: "915",
      no: "105",
      name: "李広",
      className: "Archer",
      rarity: 5,
      status: {
        maxLevel: 90,
        hpMax: 13965,
        atkMax: 11898,
        hp100: 15299,
        atk100: 13024,
        hp120: 17981,
        atk120: 15288,
      },
    });
  });

  it("falls back to the final non-empty status value when official max level has no explicit label", () => {
    const html = `
      <table>
        <tr><td colspan="14">No.016</td></tr>
        <tr><th>真名</th><td>アーラシュ</td><th>Class</th><td>アーチャー</td><th>Rare</th><td>1</td><th>Cost</th><td>3</td></tr>
        <tr>
          <th colspan="3">コマンドカード</th><th>能力値</th>
          <th>Lv. 1</th><th></th><th colspan="4">霊基再臨</th><th colspan="4">聖杯転臨</th>
        </tr>
        <tr><td>Quick</td><td>Arts</td><td>Buster</td><th>HP</th><td>1424</td><td></td><td></td><td></td><td></td><td>7122</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>1</td><td>2</td><td>2</td><th>ATK</th><td>1057</td><td></td><td></td><td></td><td></td><td>5816</td><td></td><td></td><td></td><td></td></tr>
      </table>
    `;

    const parsed = parseServantStatusPage(html, {
      source: "official",
      pageId: "74",
      pageUrl: "https://w.atwiki.jp/f_go/pages/74.html",
    });

    expect(parsed.status).toEqual({
      maxLevel: 60,
      hpMax: 7122,
      atkMax: 5816,
      hp100: undefined,
      atk100: undefined,
      hp120: undefined,
      atk120: undefined,
    });
  });
});
