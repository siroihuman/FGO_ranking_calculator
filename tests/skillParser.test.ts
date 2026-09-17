import { describe, expect, it } from "vitest";
import { parseSkillDataPage } from "../src/parsers/skillParser.js";

describe("parseSkillDataPage", () => {
  it("parses normal and strengthened skills with Lv10 values", () => {
    const html = `
      <h3>保有スキル</h3>
      <h4>Skill1：飛将軍 A</h4>
      <table>
        <tr><td>icon</td><th>CT</th><th>効果</th><th>Lv.1</th><th>Lv.10</th></tr>
        <tr><td>8</td><td>自身のQuickカード性能をアップ[Lv](3T)</td><td>20</td><td>30</td></tr>
        <tr><td>＆クリティカル威力をアップ[Lv](3T)</td><td>20</td><td>30</td></tr>
        <tr><td>＆NPを増やす[Lv]</td><td>20</td><td>30</td></tr>
      </table>
      <h4>Skill3[強化後]：虎穿ちの眼 A</h4>
      <table>
        <tr><td>icon</td><th>CT</th><th>効果</th><th>Lv.1</th><th>Lv.10</th></tr>
        <tr><td>8</td><td>自身に必中状態を付与(3T)</td></tr>
        <tr><td>＆スター発生率をアップ[Lv](3T)</td><td>50</td><td>100</td></tr>
        <tr><td>＋スターを獲得[Lv]</td><td>5</td><td>15</td></tr>
      </table>
      <h3>クラススキル</h3>
      <table>
        <tr><td>単独行動 A</td></tr>
        <tr><td>自身のクリティカル威力をアップ</td><td>10</td></tr>
      </table>
      <table>
        <tr><td>星辰融合 EX</td></tr>
        <tr><td>自身に〔神性〕特攻状態を付与</td><td>10</td></tr>
        <tr><td>＆与ダメージプラス状態を付与</td><td>250</td></tr>
      </table>
    `;

    const parsed = parseSkillDataPage(html);
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.skills[0]).toMatchObject({ slot: 1, name: "飛将軍 A", strengthened: false, ct: 8 });
    expect(parsed.skills[0].effects).toMatchObject([
      { type: "card_performance", target: "self", cardType: "quick", value: 30 },
      { type: "critical_damage", target: "self", value: 30 },
      { type: "np_charge", target: "self", value: 30 },
    ]);
    expect(parsed.skills[1]).toMatchObject({ slot: 3, strengthened: true, ct: 8 });
    expect(parsed.skills[1].effects).toMatchObject([
      { type: "sure_hit", target: "self" },
      { type: "star_generation", target: "self", value: 100 },
      { type: "instant_stars", target: "self", value: 15 },
    ]);

    expect(parsed.classSkills).toHaveLength(2);
    expect(parsed.classSkills[0]).toMatchObject({
      name: "単独行動 A",
      effects: [{ type: "critical_damage", target: "self", value: 10 }],
    });
    expect(parsed.classSkills[1].effects[0]).toMatchObject({
      type: "special_attack",
      isSpecialAttack: true,
    });
    expect(parsed.classSkills[1].effects[1]).toMatchObject({
      type: "fixed_damage",
      target: "self",
      value: 250,
    });
  });

  it("keeps standalone skill-use conditions on the next effect", () => {
    const html = `
      <h3>保有スキル</h3>
      <h4>Skill1：サマー・ガルバニズム B+</h4>
      <table>
        <tr><th>CT</th><th>効果</th><th>Lv.1</th><th>Lv.10</th></tr>
        <tr><td>7</td><td>&lt;自身のNPが10%以上ある場合のみ使用可能&gt;</td></tr>
        <tr><td>自身のNP獲得量をアップ[Lv](3T)</td><td>40</td><td>80</td></tr>
      </table>
      <h3>クラススキル</h3>
    `;
    const parsed = parseSkillDataPage(html);
    expect(parsed.skills[0].effects[0]).toMatchObject({
      type: "np_gain",
      value: 80,
      conditionText: "自身のNPが10%以上ある場合のみ使用可能",
    });
  });
});
