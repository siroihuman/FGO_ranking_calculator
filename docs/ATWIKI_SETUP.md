# atwiki設置手順

公開用ランキングは `public/ranking.bundle.js` 1ファイルを `include_js` で読み込みます。

## 1. ランキングページを管理者のみ編集可にする

`include_js` はatwiki公式ガイド上、ページの編集権限を管理者のみにする必要があります。

## 2. ページ本文

```text
#divid(fgo-ranking-root){
ランキングを読み込んでいます…
}

#include_js(https://cdn.jsdelivr.net/gh/siroihuman/FGO_ranking_calculator@main/public/ranking.bundle.js)
```

`divid` のIDは `fgo-ranking-root` のまま使用してください。bundleはこの要素へUIを描画します。要素がない場合も自動生成しますが、明示しておく方が表示位置を固定できます。

## 3. 公開ファイルの更新

`.github/workflows/update-ranking.yml` が毎日03:20 JSTに以下を実行します。

1. 公式 / オリジナル一覧を取得
2. 個別サーヴァントページを解析
3. `data/servants.status.json` とエラーレポートを生成
4. テストとビルドを実行
5. データを埋め込んだ `public/ranking.bundle.js` を生成
6. 変更がある場合のみGitHubへコミット

GitHub Actionsの `Update ranking data` から手動実行も可能です。

## 4. CDNについて

jsDelivrのGitHub配信形式 `https://cdn.jsdelivr.net/gh/<user>/<repo>@<version>/<file>` を使用します。本番では `@main` を利用するため、PRをmainへマージするまでは上記URLに今回の変更は反映されません。

## 5. UI状態

フィルター状態はブラウザのlocalStorageへ保存し、URLクエリに指定された条件を優先します。そのため、条件を設定したランキングURLをそのまま共有できます。
