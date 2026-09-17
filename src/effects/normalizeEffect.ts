import type {
  NormalizedRankingEffect,
  RankingEffectTarget,
  RankingEffectType,
  RankingEffectUnit,
} from "./types.js";
import type { CommandCardType } from "../types/servant.js";

function inferTarget(text: string, previous?: RankingEffectTarget): RankingEffectTarget {
  if (/自身を除く味方全体/.test(text)) return "all_allies_except_self";
  if (/味方全体/.test(text)) return "all_allies";
  if (/味方(?:単体|一体)/.test(text)) return "ally_single";
  if (/敵全体/.test(text)) return "all_enemies";
  if (/敵(?:単体|一体)/.test(text)) return "enemy_single";
  if (/自身/.test(text)) return "self";
  return previous ?? "unknown";
}

function cardTypeFromText(text: string): CommandCardType | undefined {
  if (/Buster/.test(text)) return "buster";
  if (/Arts/.test(text)) return "arts";
  if (/Quick/.test(text)) return "quick";
  return undefined;
}

function inferType(text: string): RankingEffectType {
  if (/特攻(?:状態|攻撃)?/.test(text)) return "special_attack";
  if (/(?:Buster|Arts|Quick)(?:カード)?(?:の)?性能/.test(text)) return "card_performance";
  if (/(?:Buster|Arts|Quick)(?:カード)?耐性/.test(text)) return "card_resistance";
  if (/攻撃力を(?:アップ|ダウン)/.test(text)) return "attack";
  if (/防御力を(?:アップ|ダウン)/.test(text)) return "defense";
  if (/宝具威力を(?:アップ|ダウン)/.test(text)) return "noble_phantasm_damage";
  if (/クリティカル威力を(?:アップ|ダウン)/.test(text)) return "critical_damage";
  if (/NP獲得量を(?:アップ|ダウン)/.test(text)) return "np_gain";
  if (/スター発生率を(?:アップ|ダウン)/.test(text)) return "star_generation";
  if (/NPを(?:増やす|チャージ|減らす)/.test(text)) return "np_charge";
  if (/スターを獲得/.test(text)) return "instant_stars";
  if (/スター集中度を(?:アップ|ダウン)/.test(text)) return "star_focus";
  if (/与ダメージプラス/.test(text)) return "fixed_damage";
  if (/必中状態/.test(text)) return "sure_hit";
  return "other";
}

function inferUnit(type: RankingEffectType): RankingEffectUnit {
  if (type === "np_charge") return "np_percent";
  if (type === "instant_stars") return "stars";
  if (type === "fixed_damage") return "flat";
  if (type === "sure_hit" || type === "other") return "state";
  return "percent";
}

function signedValue(text: string, value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return /ダウン|減らす/.test(text) ? -Math.abs(value) : value;
}

function durationTurns(text: string): number | undefined {
  const match = text.match(/\((\d+)T\)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function remainingUses(text: string): number | undefined {
  const match = text.match(/\((\d+)回(?:・\d+T)?\)/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function activationRate(text: string): number | undefined {
  const match = text.match(/確率\s*(\d+(?:\.\d+)?)\s*[％%]/);
  return match ? Number(match[1]) : undefined;
}

function embeddedCondition(text: string): string | undefined {
  const angles = [...text.matchAll(/[<＜]([^>＞]+)[>＞]/g)]
    .map((match) => match[1].trim())
    .filter((value) => !/^OC\s*[:：]/i.test(value));
  if (angles.length > 0) return angles[0];
  const condition = text.match(/([^。]+(?:場合|時)(?:のみ)?)/);
  return condition?.[1]?.trim();
}

export function normalizeRankingEffect(
  rawText: string,
  value?: number,
  previousTarget?: RankingEffectTarget,
  inheritedCondition?: string,
): NormalizedRankingEffect {
  const text = rawText.replace(/^\s*[＆＋+]/, "").trim();
  const type = inferType(text);
  const cardType = cardTypeFromText(text);
  const target = inferTarget(text, previousTarget);
  const probability = activationRate(text);
  const conditionText = inheritedCondition ?? embeddedCondition(text);
  return {
    type,
    target,
    rawText,
    value: signedValue(text, value),
    unit: inferUnit(type),
    ...(cardType ? { cardType } : {}),
    ...(durationTurns(text) !== undefined ? { durationTurns: durationTurns(text) } : {}),
    ...(remainingUses(text) !== undefined ? { remainingUses: remainingUses(text) } : {}),
    probabilistic: /確率/.test(text),
    ...(probability !== undefined ? { activationRatePercent: probability } : {}),
    ...(conditionText ? { conditionText } : {}),
    isSpecialAttack: type === "special_attack",
  };
}
