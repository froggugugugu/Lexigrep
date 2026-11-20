# ADR-003: FSRS の 2 値評価への写像とデイリーセッションの規則

- ステータス: Accepted
- 日付: 2026-11-01
- 関連: `src/features/srs/scheduler.ts`、`src/features/session/build-session.ts`

## 背景

要件は回答を正誤の 2 値としている(「実文を読んで意味を答え、間違えたらその場で解説を見たい」)が、FSRS は Again / Hard / Good / Easy の 4 段階を前提とする。
また「1 セッション 3〜7 分」「覚えていないカードだけが再出題される」を決定論的に満たす規則が必要だった。

## 決定

- ts-fsrs 6(FSRS-7)を `DefaultScheduler({ enableFuzz: false, desiredRetention: 0.9 })` で使い、**correct → Good / incorrect → Again** に固定で写像する(【仮定】Hard / Easy は使わない)
- 「定着」は `state = review` かつ `stability ≥ 21 日`(【仮定】成功指標「カード定着率」の算出基準)
- セッションは「期限切れの復習カード(期限の古い順)→ 未学習カード(frequency_rank 順)」で埋め、枚数は設定(8 / 12 / 16 / 20、約 20 秒/枚)
- 間違えたカードは同じセッションの末尾で 1 回だけ再出題する。学習ログに記録する結果は**最初の回答のみ**(正答率の指標を歪めないため)。再出題の回答も FSRS には反映する
- 回答ごとに SRS 状態を保存する(セッション途中で離脱しても進捗が残る)

## 代替案

- 回答時間で Good / Easy を分ける — 端末や文の長さに依存し再現性が低い
- 自前の FSRS 実装 — パラメータ更新への追随コストが高い。ts-fsrs は参照実装として広く使われている

## 影響

- 2 値のため FSRS の難易度推定は 4 段階より粗いが、MVP の目的(読めるようになる)には十分と判断。P1 以降で「自信あり」ボタンの追加を検討できる
- `scheduleStatus` は ts-fsrs 側に `relearning` が無いため `learning` として渡す(`review_states.state` には relearning を保持)
