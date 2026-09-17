# FGO_ranking_calculator

atwiki上の公式FGOサーヴァントと `siroi_human` のオリジナルサーヴァントを収集・解析し、各種ランキングを生成するためのプロジェクトです。

## データ収集元

- 公式一覧: https://w.atwiki.jp/f_go/pages/671.html
- オリジナル一覧: https://w.atwiki.jp/siroi_human/pages/54.html
  - 「サーヴァント」見出し以下のみを対象とします。
  - 「データ」見出し以下のフレーバーテキストはランキング収集対象外です。

## 予定ランキング

- HP / ATK
- NP獲得量
- スター獲得量
- 宝具ダメージ（スキル有/無）
- システムダメージ / NP獲得量
- バフ量（自身 / 味方）

ダメージ・NP・スターの計算仕様は `siroihuman/FGO_Battle_Simulator_Work` を基準とします。

## 現在の実装段階

初期フェーズではHP/ATKランキングの共通型とランキング計算コアを実装しています。
