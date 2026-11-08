# content

学習コンテンツ(Pattern)とその検証。

- `patterns/docs.json` / `saas-ui.json` / `dev-comm.json`: Pattern の配列(1ファイル=1カテゴリ)。1ファイル1オブジェクトでも検証は通る。
- 検証: `node content/validate.mjs`(依存なし、Node 18+)。id一意・必須項目・answer範囲・clozeの `____` が1つ・drills>=2・選択肢3〜4個かつ重複なし・正解位置の偏りを確認する。
- 選択肢は正解位置をシャッフル済み。アプリ側で再シャッフルしてもよい(`answer` は `choices_*` のインデックス)。
- 追加時の指針: 実在する典型表現のみ。誤答は文法的・意味的にもっともらしくする。
