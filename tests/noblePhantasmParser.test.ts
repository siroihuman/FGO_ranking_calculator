import { describe, expect, it } from "vitest";
import { parseNoblePhantasmPage } from "../src/parsers/noblePhantasmParser.js";

describe("parseNoblePhantasmPage", () => {
  it("parses an original Quick NP and preserves before/attack/after order", () => {
    const html = `
      <h3>宝具</h3>
      <p>白虎吼、星墜つるは秋の箭</p>
      <table>
        <tr><th>Card</th><th>ランク</th><th>種別</th><th>効果</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
        <tr><td>Quick</td><td>EX</td><td>対軍宝具</td><td>自身の宝具威力をアップ(3T)&lt;OC:効果UP&gt;</td><td>10</td><td>15</td><td>20</td><td>25</td><td>30</td></tr>
        <tr><td colspan="4">＆NP獲得量をアップ(3T)</td><td>20</td></tr>
        <tr><td colspan="4">＋敵全体に強力な攻撃[Lv] Quick(x0.8)</td><td>600</td><td>800</td><td>900</td><td>950</td><td>1000</td></tr>
        <tr><td colspan="4">＋味方全体の宝具威力をアップ(3T)&lt;OC:効果UP&gt;</td><td>10</td><td>15</td><td>20</td><td>25</td><td>30</td></tr>
      </table>
    `;

    const parsed = parseNoblePhantasmPage(html, 9);
    expect(parsed.cardType).toBe("quick");
    expect(parsed.targetScope).toBe("all");
    expect(parsed.hitCount).toBe(9);
    expect(parsed.damageMultiplierPermilleByLevel).toEqual([6000, 8000, 9000, 9500, 10000]);
    expect(parsed.effectRows.map((row) => row.phase)).toEqual([
      "before_attack",
      "before_attack",
      "attack",
      "after_attack",
    ]);
  });

  it("treats NPs without an attack row as support", () => {
    const html = `
      <h3>宝具</h3>
      <table>
        <tr><th>Card</th><th>ランク</th><th>種別</th><th>効果</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
        <tr><td>Arts</td><td>A</td><td>対人宝具</td><td>味方全体の攻撃力をアップ</td><td>20</td><td>25</td><td>30</td><td>35</td><td>40</td></tr>
      </table>
    `;
    const parsed = parseNoblePhantasmPage(html);
    expect(parsed.cardType).toBe("arts");
    expect(parsed.targetScope).toBe("support");
    expect(parsed.damageMultiplierPermilleByLevel).toBeUndefined();
  });
});
