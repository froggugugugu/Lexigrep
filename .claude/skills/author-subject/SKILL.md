---
name: author-subject
description: >
  英語の公式ドキュメントサイトを題材として追加し、実文に紐づく学習カード(draft)を作る。
  雛形作成 → クロール → 頻度集計 → 執筆スペック → カード起こし → 実文照合までを 1 本で進める。
  「題材を追加」「このサイトでカードを作って」「〇〇の英語を学びたい」の依頼で使う。
argument-hint: "<題材サイトのルート URL> [題材 ID]"
allowed-tools: Read, Glob, Grep, Bash(pnpm *), Bash(ls *), Bash(wc *), Bash(head *), Edit(content/**), Edit(pipeline/specs/**), Write(pipeline/specs/**), Write(pipeline/work/**), WebFetch
effort: medium
---

# author-subject — 題材の追加とカード執筆

カードの実文は必ずクロール済みコーパスから選ぶ(`pipeline:author` が選び、`pipeline:verify` が照合する)。
自分で英文を書いたり WebFetch の要約を実文にしたりしない。学習者は実在の文で学ぶのが本アプリの前提で、捏造した文はその前提を壊すため。

公開(`published`)は人間がレビューしてから行う。この skill は draft までを作る。

## 手順

1. **題材を決める**: URL から題材 ID(slug)・表示名・カテゴリ(slug。既知: `genai` / `language_fw` / `cloud` / `idp` / `testing`、他は `--category-label` で表示名を付ける)・説明(200 字以内)を提案し、ユーザーに確認する。`content/<id>/` が既にあれば、追加か別 ID かを聞く
2. **利用条件を確認する**: サイトのライセンス表記・利用規約・robots.txt を WebFetch で確認し、`license_note` の文案(ライセンス名・帰属表示の要否・「文単位の短い引用に限定」)を作る。条件が見つからない / 引用を禁じている場合は止めてユーザーに判断を求める
3. **雛形を作る**:
   `pnpm content:init --subject <id> --name "<表示名>" --category <slug> --url <ルート URL> --description "<説明>" --license-note "<文案>"`
4. **クロールする**: `pnpm pipeline:crawl --subject <id> [--max-pages 150] [--exclude-path release-notes]`。ページ数と本文量を `pipeline/work/<id>/pages.json` で確認し、本文がほとんど取れていなければユーザーに報告する(JS で描画するサイト、Markdown 版が別にあるサイトはクローラの対象外)
5. **頻度を集計する**: `pnpm pipeline:frequency --subject <id> --top 300`。`pipeline/work/<id>/frequency.json` の上位と例文を読む
6. **執筆スペックを書く**: `pipeline/specs/<id>.json`。書き方・層の選び方・選択肢の作り方は `references/spec-writing.md` を読んでから書く。初回は 30〜60 枚を目安にする
7. **カードを起こす**:
   `pnpm pipeline:author --subject <id> --spec pipeline/specs/<id>.json --out pipeline/work/authored/<id>/cards.jsonl`
   出力の `target | sentence` を一覧で確認し、文脈の無い文・見出しの断片・target が語の一部になっている文を `match` / `url_hint` / `pick` で差し替えて再実行する。author は既存の出力にマージするので、差し替えるときは出力ファイルを消してから再実行する(消さないと差し替え前のカードが残る)
8. **確定する**: 出力を `content/<id>/cards.jsonl` に置き、`pnpm content:validate <id> --write-manifest` → `pnpm pipeline:verify --subject <id>` を実行する。verify の不一致は 0 件にする
9. **報告する**: 枚数(層別)・verify の結果・`license_note`・目視で気になったカードを報告し、次の手順を案内する
   - レビュー: `pnpm content:review <id>` → `pnpm content:review <id> --publish`
   - 手元で学ぶ: `LEXIGREP_DATA_SOURCE=local pnpm dev`(題材は起動時に読むので、追加後は dev サーバーを再起動する)

## 止めてユーザーに聞く場面

| 場面 | 理由 |
| ---- | ---- |
| 利用条件が不明 / 引用を禁じている | 再配布の可否はユーザーが決める |
| robots.txt がクロールを拒否している | クローラは拒否されたパスを取らない。別のルートを選ぶか中止する |
| `content/<id>/` が既にある | 既存カードと学習履歴を壊さないため |
| クロールで本文がほとんど取れない | 実文が足りず、カードの質が保てない |

## 参照

- `references/spec-writing.md` — 執筆スペックを書く前に読む(項目・層・選択肢・よくある失敗)
- `docs/development-patterns.md` §9 — 手順の要点と過去の知見
- `pipeline/specs/typescript.json` — 既存の執筆スペックの実例
