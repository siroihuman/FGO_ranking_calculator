import type { ServantStatusRecord } from "../types/servant.js";
import { buildStatusRanking, type FouBonus, type StatusLevel } from "../ranking/statusRanking.js";
import { buildNpRanking, npRankingServantsFromStatus } from "../ranking/npRanking.js";
import { buildStarRanking, starRankingServantsFromStatus } from "../ranking/starRanking.js";
import { buildNoblePhantasmNpRanking } from "../ranking/noblePhantasmNpRanking.js";
import { buildNoblePhantasmDamageRanking, type NoblePhantasmLevel } from "../ranking/noblePhantasmDamageRanking.js";
import { buildBuffRanking, type BuffRankingCategory } from "../ranking/buffRanking.js";
import { buildSystemDamageRanking, type SystemDamageSort } from "../system/systemDamageRanking.js";
import { buildSystemRefundRanking } from "../system/systemRefundRanking.js";
import { SYSTEM_PRESETS, presetById } from "../system/presets.js";
import type { SystemLoadout, SystemMysticCodeId } from "../system/systemLoadout.js";
import type { NormalCardType, CommandPosition } from "../formulas/cardNp.js";

declare const __FGO_RANKING_DATA__: ServantStatusRecord[];
declare const __FGO_RANKING_META__: Record<string, unknown>;

type TabId = "status" | "np" | "stars" | "damage" | "system" | "buff";
type SourceId = "all" | "official" | "original";
type Direction = "desc" | "asc";

interface UiState {
  tab: TabId;
  source: SourceId;
  className: string;
  rarity: string;
  name: string;
  limit: string;
  direction: Direction;
  statusKind: "atk" | "hp";
  statusLevel: "max" | "100" | "120";
  fou: "0" | "1000" | "2000";
  npMode: "normal" | "noble";
  card: NormalCardType;
  position: "1" | "2" | "3";
  skills: boolean;
  conditional: boolean;
  npLevel: "1" | "2" | "3" | "4" | "5";
  systemPreset: string;
  systemMetric: "damage" | "refund";
  systemSort: SystemDamageSort;
  craftEssence: "none" | "black-grail";
  mysticCode: SystemMysticCodeId;
  manaLoading: string;
  skillReloading: string;
  buffTarget: "self" | "ally";
  buffCategory: BuffRankingCategory;
}

const STORAGE_KEY = "fgo-ranking-ui-v1";
const records = __FGO_RANKING_DATA__ ?? [];
const meta = __FGO_RANKING_META__ ?? {};

const defaults: UiState = {
  tab: "status",
  source: "all",
  className: "all",
  rarity: "all",
  name: "",
  limit: "50",
  direction: "desc",
  statusKind: "atk",
  statusLevel: "max",
  fou: "1000",
  npMode: "normal",
  card: "arts",
  position: "1",
  skills: false,
  conditional: false,
  npLevel: "1",
  systemPreset: SYSTEM_PRESETS[0]?.id ?? "",
  systemMetric: "damage",
  systemSort: "total",
  craftEssence: "none",
  mysticCode: "none",
  manaLoading: "0",
  skillReloading: "0",
  buffTarget: "self",
  buffCategory: "total",
};

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

function loadState(): UiState {
  let stored: Partial<UiState> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<UiState>;
  } catch {
    stored = {};
  }
  const merged = { ...defaults, ...stored } as UiState;
  const query = new URLSearchParams(location.search);
  for (const key of Object.keys(defaults) as Array<keyof UiState>) {
    const raw = query.get(key);
    if (raw === null) continue;
    if (typeof defaults[key] === "boolean") {
      (merged as unknown as Record<string, unknown>)[key] = parseBoolean(raw, defaults[key] as boolean);
    } else {
      (merged as unknown as Record<string, unknown>)[key] = raw;
    }
  }
  return merged;
}

let state = loadState();

function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === "" || value === false || value === defaults[key as keyof UiState]) continue;
    params.set(key, typeof value === "boolean" ? "1" : String(value));
  }
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHref(value: string): string {
  try {
    const url = new URL(value, location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
  } catch {
    return "#";
  }
}

function filteredRecords(): ServantStatusRecord[] {
  const search = state.name.trim().toLocaleLowerCase("ja");
  return records.filter((servant) => {
    if (state.source !== "all" && servant.source !== state.source) return false;
    if (state.className !== "all" && servant.className !== state.className) return false;
    if (state.rarity !== "all" && servant.rarity !== Number(state.rarity)) return false;
    if (search && !servant.name.toLocaleLowerCase("ja").includes(search)) return false;
    return true;
  });
}

function rerank<T>(rows: T[], value: (row: T) => number): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => {
    const delta = value(a) - value(b);
    return state.direction === "asc" ? delta : -delta;
  });
  let previous: number | undefined;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const current = value(row);
    const rank = current === previous ? previousRank : index + 1;
    previous = current;
    previousRank = rank;
    return { ...row, rank };
  });
}

function limited<T>(rows: readonly T[]): T[] {
  if (state.limit === "all") return [...rows];
  return [...rows].slice(0, Math.max(1, Number(state.limit) || 50));
}

function servantCell(servant: ServantStatusRecord): string {
  return `<a class="fgo-rank-name" href="${esc(safeHref(servant.pageUrl))}" target="_blank" rel="noopener noreferrer">${esc(servant.name)}</a>`;
}

function probabilityMark(value: boolean): string {
  return value ? '<span class="fgo-rank-note">確率効果</span>' : "";
}

function detailEffects(effects: readonly { rawText: string }[] | undefined): string {
  if (!effects?.length) return "";
  return `<details><summary>詳細</summary><ul>${effects.map((effect) => `<li>${esc(effect.rawText)}</li>`).join("")}</ul></details>`;
}

function table(headers: string[], body: string): string {
  return `<div class="fgo-rank-table-wrap"><table class="fgo-rank-table"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">該当データがありません。</td></tr>`}</tbody></table></div>`;
}

function renderStatus(): string {
  const rows = buildStatusRanking(filteredRecords(), {
    kind: state.statusKind,
    level: state.statusLevel === "max" ? "max" : Number(state.statusLevel) as StatusLevel,
    fou: Number(state.fou) as FouBonus,
  });
  const ranked = limited(rerank(rows, (row) => row.value));
  return `${controls([
    select("statusKind", "順位対象", [["atk", "ATK"], ["hp", "HP"]]),
    select("statusLevel", "Lv", [["max", "自然上限"], ["100", "Lv100"], ["120", "Lv120"]]),
    select("fou", "フォウ", [["0", "なし"], ["1000", "+1000"], ["2000", "+2000"]]),
  ])}${table(["順位", "No.", "サーヴァント", "Class", "Rare", state.statusKind.toUpperCase()], ranked.map((row) => `<tr><td>${row.rank}</td><td>${esc(row.servant.no)}</td><td>${servantCell(row.servant)}</td><td>${esc(row.servant.className)}</td><td>★${row.servant.rarity}</td><td class="num">${row.value.toLocaleString()}</td></tr>`).join(""))}`;
}

function renderNp(): string {
  if (state.npMode === "noble") {
    const rows = buildNoblePhantasmNpRanking(filteredRecords(), {
      skills: state.skills,
      conditionalEffects: state.conditional,
    });
    const ranked = limited(rerank(rows, (row) => row.npUnits));
    return `${npControls()}${table(["順位", "サーヴァント", "Hit", "NP回収", "備考"], ranked.map((row) => `<tr><td>${row.rank}</td><td>${servantCell(row.servant)}</td><td>${row.hitCount}</td><td class="num">${row.npPercent.toFixed(2)}%</td><td>${probabilityMark(row.usesProbabilisticEffect)}${detailEffects(row.appliedEffects)}</td></tr>`).join(""))}`;
  }
  const rows = buildNpRanking(npRankingServantsFromStatus(filteredRecords()), {
    cardType: state.card,
    position: Number(state.position) as CommandPosition,
    skills: state.skills,
    conditionalEffects: state.conditional,
  });
  const ranked = limited(rerank(rows, (row) => row.npUnits));
  return `${npControls()}${table(["順位", "サーヴァント", "Hit", "NP獲得", "備考"], ranked.map((row) => `<tr><td>${row.rank}</td><td><a class="fgo-rank-name" href="${esc(safeHref(row.pageUrl))}" target="_blank" rel="noopener noreferrer">${esc(row.name)}</a></td><td>${row.hits}</td><td class="num">${row.npPercent.toFixed(2)}%</td><td>${probabilityMark(row.usesProbabilisticEffect)}${detailEffects(row.appliedEffects)}</td></tr>`).join(""))}`;
}

function npControls(): string {
  return controls([
    select("npMode", "攻撃", [["normal", "通常攻撃"], ["noble", "宝具"]]),
    ...(state.npMode === "normal" ? [
      select("card", "カード", [["buster", "Buster"], ["arts", "Arts"], ["quick", "Quick"], ["extra", "Extra"]]),
      select("position", "位置", [["1", "1st"], ["2", "2nd"], ["3", "3rd"]]),
    ] : []),
    check("skills", "スキルあり"),
    check("conditional", "条件あり"),
  ]);
}

function renderStars(): string {
  const rows = buildStarRanking(starRankingServantsFromStatus(filteredRecords()), {
    cardType: state.card,
    position: Number(state.position) as CommandPosition,
    skills: state.skills,
    conditionalEffects: state.conditional,
  });
  const ranked = limited(rerank(rows, (row) => row.expectedStars));
  return `${controls([
    select("card", "カード", [["buster", "Buster"], ["arts", "Arts"], ["quick", "Quick"], ["extra", "Extra"]]),
    select("position", "位置", [["1", "1st"], ["2", "2nd"], ["3", "3rd"]]),
    check("skills", "スキルあり"),
    check("conditional", "条件あり"),
  ])}${table(["順位", "サーヴァント", "Hit", "スター期待値", "備考"], ranked.map((row) => `<tr><td>${row.rank}</td><td><a class="fgo-rank-name" href="${esc(safeHref(row.pageUrl))}" target="_blank" rel="noopener noreferrer">${esc(row.name)}</a></td><td>${row.hits}</td><td class="num">${row.expectedStars.toFixed(3)}</td><td>${probabilityMark(row.usesProbabilisticEffect)}${detailEffects(row.appliedEffects)}</td></tr>`).join(""))}`;
}

function renderDamage(): string {
  const rows = buildNoblePhantasmDamageRanking(filteredRecords(), {
    noblePhantasmLevel: Number(state.npLevel) as NoblePhantasmLevel,
    level: state.statusLevel === "max" ? "max" : Number(state.statusLevel) as StatusLevel,
    fou: Number(state.fou) as FouBonus,
    skills: state.skills,
    conditionalEffects: state.conditional,
  });
  const ranked = limited(rerank(rows, (row) => row.averageDamage));
  return `${controls([
    select("npLevel", "宝具Lv", [["1", "NP1"], ["2", "NP2"], ["3", "NP3"], ["4", "NP4"], ["5", "NP5"]]),
    select("statusLevel", "Lv", [["max", "自然上限"], ["100", "Lv100"], ["120", "Lv120"]]),
    select("fou", "フォウ", [["0", "なし"], ["1000", "+1000"], ["2000", "+2000"]]),
    check("skills", "スキルあり"), check("conditional", "条件あり"),
  ])}${table(["順位", "サーヴァント", "最低", "平均", "最高", "備考"], ranked.map((row) => `<tr><td>${row.rank}</td><td>${servantCell(row.servant)}</td><td class="num">${row.minimumDamage.toLocaleString()}</td><td class="num">${Math.round(row.averageDamage).toLocaleString()}</td><td class="num">${row.maximumDamage.toLocaleString()}</td><td>${probabilityMark(row.usesProbabilisticEffect)}${detailEffects(row.appliedEffects)}</td></tr>`).join(""))}`;
}

function loadout(): SystemLoadout {
  return {
    craftEssence: state.craftEssence,
    mysticCode: state.mysticCode,
    append: {
      manaLoadingLevel: Number(state.manaLoading) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      skillReloadingLevel: Number(state.skillReloading) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
    },
  };
}

function renderSystem(): string {
  const preset = presetById(state.systemPreset) ?? SYSTEM_PRESETS[0];
  if (!preset) return "<p>システムプリセットがありません。</p>";
  const common = controls([
    select("systemPreset", "編成", SYSTEM_PRESETS.map((item) => [item.id, item.name])),
    select("systemMetric", "順位対象", [["damage", "宝具ダメージ"], ["refund", "NP回収量"]]),
    select("systemSort", "並べ替え", [["total", "3Wave合計"], ["wave1", "1Wave"], ["wave2", "2Wave"], ["wave3", "3Wave"]]),
    select("craftEssence", "概念礼装", [["none", "なし"], ["black-grail", "黒の聖杯"]]),
    select("mysticCode", "魔術礼装", [["none", "なし"], ["normal-chaldea-uniform", "ノーマルカルデア制服"], ["atlas-academy-uniform", "アトラス院制服"], ["mage-association-uniform", "魔術協会制服"]]),
    select("manaLoading", "魔力装填", Array.from({ length: 11 }, (_, i) => [String(i), i ? `Lv${i}` : "なし"])),
    select("skillReloading", "スキル再装填", Array.from({ length: 11 }, (_, i) => [String(i), i ? `Lv${i}` : "なし"])),
    check("skills", "自身スキルあり"), check("conditional", "条件あり"),
  ]);
  if (state.systemMetric === "refund") {
    const rows = buildSystemRefundRanking(filteredRecords(), preset, {
      includeAttackerSkills: state.skills,
      conditionalEffects: state.conditional,
      sortBy: state.systemSort,
      loadout: loadout(),
    });
    const getter = (row: (typeof rows)[number]) => state.systemSort === "total" ? row.totalNpPercent : row.waves[Number(state.systemSort.at(-1)) - 1]?.npPercent ?? 0;
    const ranked = limited(rerank(rows, getter));
    return `${common}${table(["順位", "サーヴァント", "1W", "2W", "3W", "合計", "詳細"], ranked.map((row) => `<tr><td>${row.rank}</td><td>${servantCell(row.servant)}</td>${row.waves.map((wave) => `<td class="num">${wave.npPercent.toFixed(2)}%</td>`).join("")}<td class="num">${row.totalNpPercent.toFixed(2)}%</td><td>${row.attackerSkillPlan ? `<details><summary>行動</summary><pre>${esc(JSON.stringify(row.attackerSkillPlan))}</pre></details>` : ""}</td></tr>`).join(""))}`;
  }
  const rows = buildSystemDamageRanking(filteredRecords(), preset, {
    includeAttackerSkills: state.skills,
    conditionalEffects: state.conditional,
    sortBy: state.systemSort,
    loadout: loadout(),
  });
  const getter = (row: (typeof rows)[number]) => state.systemSort === "total" ? row.totalAverageDamage : row.waves[Number(state.systemSort.at(-1)) - 1]?.averageDamage ?? 0;
  const ranked = limited(rerank(rows, getter));
  return `${common}${table(["順位", "サーヴァント", "1W平均", "2W平均", "3W平均", "3Wave合計", "詳細"], ranked.map((row) => `<tr><td>${row.rank}</td><td>${servantCell(row.servant)}</td>${row.waves.map((wave) => `<td class="num">${Math.round(wave.averageDamage).toLocaleString()}</td>`).join("")}<td class="num">${Math.round(row.totalAverageDamage).toLocaleString()}</td><td>${row.attackerSkillPlan ? `<details><summary>行動</summary><pre>${esc(JSON.stringify(row.attackerSkillPlan))}</pre></details>` : ""}</td></tr>`).join(""))}`;
}

function renderBuff(): string {
  const rows = buildBuffRanking(filteredRecords(), {
    target: state.buffTarget,
    category: state.buffCategory,
    conditionalEffects: state.conditional,
  });
  const ranked = limited(rerank(rows, (row) => row.value));
  return `${controls([
    select("buffTarget", "対象", [["self", "自身"], ["ally", "味方"]]),
    select("buffCategory", "種類", [["total", "合計"], ["attack", "攻撃力"], ["buster", "Buster"], ["arts", "Arts"], ["quick", "Quick"], ["noble_phantasm_damage", "宝具威力"], ["critical_damage", "クリティカル"], ["np_gain", "NP獲得量"], ["star_generation", "スター発生率"]]),
    check("conditional", "条件あり"),
  ])}${table(["順位", "サーヴァント", "合計", "攻撃", "B", "A", "Q", "宝具", "Crit", "NP", "Star", "備考"], ranked.map((row) => `<tr><td>${row.rank}</td><td>${servantCell(row.servant)}</td><td class="num">${row.breakdown.total}%</td><td>${row.breakdown.attack}%</td><td>${row.breakdown.buster}%</td><td>${row.breakdown.arts}%</td><td>${row.breakdown.quick}%</td><td>${row.breakdown.noblePhantasmDamage}%</td><td>${row.breakdown.criticalDamage}%</td><td>${row.breakdown.npGain}%</td><td>${row.breakdown.starGeneration}%</td><td>${probabilityMark(row.usesProbabilisticEffect)}${detailEffects(row.appliedEffects)}</td></tr>`).join(""))}`;
}

function select(key: keyof UiState, label: string, options: readonly (readonly [string, string])[]): string {
  const current = String(state[key]);
  return `<label>${esc(label)}<select data-state="${esc(key)}">${options.map(([value, text]) => `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}

function check(key: keyof UiState, label: string): string {
  return `<label class="fgo-rank-check"><input type="checkbox" data-state="${esc(key)}"${state[key] ? " checked" : ""}>${esc(label)}</label>`;
}

function controls(items: readonly string[]): string {
  return `<div class="fgo-rank-controls">${items.join("")}</div>`;
}

function commonControls(): string {
  const classes = [...new Set(records.map((record) => record.className))].sort();
  return controls([
    select("source", "データ", [["all", "公式＋オリジナル"], ["official", "公式"], ["original", "オリジナル"]]),
    select("className", "Class", [["all", "すべて"], ...classes.map((item) => [item, item] as [string, string])]),
    select("rarity", "Rare", [["all", "すべて"], ["5", "★5"], ["4", "★4"], ["3", "★3"], ["2", "★2"], ["1", "★1"]]),
    `<label>名前<input type="search" data-state="name" value="${esc(state.name)}" placeholder="部分一致"></label>`,
    select("limit", "表示", [["20", "20"], ["50", "50"], ["100", "100"], ["all", "すべて"]]),
    select("direction", "順序", [["desc", "降順"], ["asc", "昇順"]]),
    '<button type="button" data-action="reset">条件をリセット</button>',
  ]);
}

function tabBody(): string {
  if (state.tab === "status") return renderStatus();
  if (state.tab === "np") return renderNp();
  if (state.tab === "stars") return renderStars();
  if (state.tab === "damage") return renderDamage();
  if (state.tab === "system") return renderSystem();
  return renderBuff();
}

const CSS = `
.fgo-ranking-app{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}
.fgo-rank-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px}.fgo-rank-tabs button{padding:7px 12px;border:1px solid #aaa;background:#f6f6f6;cursor:pointer}.fgo-rank-tabs button.active{font-weight:700;background:#ddd}
.fgo-rank-controls{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:end;margin:8px 0 12px;padding:10px;border:1px solid #ccc;border-radius:4px}.fgo-rank-controls label{display:flex;flex-direction:column;gap:3px;font-size:12px}.fgo-rank-controls select,.fgo-rank-controls input[type=search],.fgo-rank-controls button{font:inherit;padding:4px 6px}.fgo-rank-controls .fgo-rank-check{flex-direction:row;align-items:center;font-size:13px;padding-bottom:5px}
.fgo-rank-table-wrap{overflow-x:auto}.fgo-rank-table{border-collapse:collapse;width:100%;min-width:640px}.fgo-rank-table th,.fgo-rank-table td{border:1px solid #bbb;padding:5px 7px;vertical-align:top}.fgo-rank-table th{white-space:nowrap;background:#eee}.fgo-rank-table .num{text-align:right;font-variant-numeric:tabular-nums}.fgo-rank-name{font-weight:600}.fgo-rank-note{display:inline-block;font-size:11px;padding:1px 4px;border:1px solid #999;border-radius:3px;margin-right:4px}.fgo-rank-meta{font-size:12px;color:#666;margin:8px 0}.fgo-rank-table details{font-size:12px}.fgo-rank-table pre{white-space:pre-wrap;margin:4px 0}.fgo-rank-error{padding:12px;border:1px solid #c55;background:#fee}
@media(max-width:640px){.fgo-rank-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.fgo-rank-controls label{min-width:0}.fgo-rank-controls select,.fgo-rank-controls input{max-width:100%}}
`;

function ensureStyle(): void {
  if (document.getElementById("fgo-ranking-style")) return;
  const style = document.createElement("style");
  style.id = "fgo-ranking-style";
  style.textContent = CSS;
  document.head.appendChild(style);
}

function rootElement(): HTMLElement {
  const existing = document.getElementById("fgo-ranking-root");
  if (existing) return existing;
  const root = document.createElement("div");
  root.id = "fgo-ranking-root";
  (document.querySelector("#content") ?? document.body).appendChild(root);
  return root;
}

function render(): void {
  ensureStyle();
  const root = rootElement();
  const tabs: Array<[TabId, string]> = [["status", "HP/ATK"], ["np", "NP獲得量"], ["stars", "スター獲得量"], ["damage", "宝具ダメージ"], ["system", "システム"], ["buff", "バフ量"]];
  const generatedAt = typeof meta.generatedAt === "string" ? meta.generatedAt : "未生成";
  root.className = "fgo-ranking-app";
  root.innerHTML = `<div class="fgo-rank-tabs">${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" class="${state.tab === id ? "active" : ""}">${label}</button>`).join("")}</div>${commonControls()}<div class="fgo-rank-meta">収録 ${records.length}騎 / データ更新 ${esc(generatedAt)}</div><div data-role="body">${tabBody()}</div>`;
  bind(root);
}

function bind(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-tab]").forEach((element) => {
    element.addEventListener("click", () => {
      state.tab = element.dataset.tab as TabId;
      saveState();
      render();
    });
  });
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-state]").forEach((element) => {
    const event = element instanceof HTMLInputElement && element.type === "search" ? "input" : "change";
    element.addEventListener(event, () => {
      const key = element.dataset.state as keyof UiState;
      const value: unknown = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : element.value;
      (state as unknown as Record<string, unknown>)[key] = value;
      saveState();
      render();
    });
  });
  root.querySelector<HTMLElement>("[data-action=reset]")?.addEventListener("click", () => {
    state = { ...defaults, tab: state.tab };
    saveState();
    render();
  });
}

function boot(): void {
  try {
    render();
  } catch (error) {
    const root = rootElement();
    root.innerHTML = `<div class="fgo-rank-error">ランキング表示中にエラーが発生しました。<pre>${esc(error instanceof Error ? error.message : error)}</pre></div>`;
    console.error(error);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
