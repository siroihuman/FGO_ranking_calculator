import { describe, expect, it } from "vitest";
import {
  parseOfficialServantList,
  parseOriginalServantList,
} from "../src/collectors/listCollector.js";

describe("servant list collectors", () => {
  it("reads only the original サーヴァント section", () => {
    const html = `
      <h3>サーヴァント</h3>
      <table>
        <tr><th>C★</th><th>UC★★</th><th>R★★★</th><th>SR★★★★</th><th>SSR★★★★★</th></tr>
        <tr><td><a href="/siroi_human/pages/100.html">A</a></td><td></td><td></td><td></td><td><a href="/siroi_human/pages/915.html">李広</a></td></tr>
      </table>
      <h3>エネミー</h3>
      <a href="/siroi_human/pages/999.html">Enemy</a>
      <h3>データ</h3>
      <a href="/siroi_human/pages/500.html">001 A</a>
    `;

    expect(parseOriginalServantList(html)).toEqual([
      {
        source: "original",
        name: "A",
        pageId: "100",
        pageUrl: "https://w.atwiki.jp/siroi_human/pages/100.html",
      },
      {
        source: "original",
        name: "李広",
        pageId: "915",
        pageUrl: "https://w.atwiki.jp/siroi_human/pages/915.html",
      },
    ]);
  });

  it("selects the official rarity/class table instead of unrelated tables", () => {
    const html = `
      <table><tr><td><a href="/f_go/pages/999.html">menu</a></td></tr></table>
      <table>
        <tr><th>C★</th><th>UC★★</th><th>R★★★</th><th>SR★★★★</th><th>SSR★★★★★</th></tr>
        <tr>
          <td><a href="/f_go/pages/74.html">アーラシュ</a></td>
          <td></td><td></td><td></td>
          <td><a href="/f_go/pages/1.html">アルトリア</a></td>
        </tr>
      </table>
    `;

    expect(parseOfficialServantList(html).map(({ pageId, name }) => ({ pageId, name })))
      .toEqual([
        { pageId: "74", name: "アーラシュ" },
        { pageId: "1", name: "アルトリア" },
      ]);
  });
});
