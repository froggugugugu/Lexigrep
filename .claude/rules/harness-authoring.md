---
paths:
  - ".claude/**/*.md"
  - ".claude/**/*.json"
  - ".claude/workflows/**"
  - "CLAUDE.md"
  - "AGENTS.md"
---
# ハーネス執筆規約 — CLAUDE.md / skill / agent / rules / workflow の書き方

> **path-specific rule**: ハーネス自身のファイルを編集するときだけ load される。
> 出典: Anthropic 公式(best-practices / memory / skills / sub-agents / hooks / workflows / skill authoring best practices / Claude 5 系のプロンプティングガイド)と agentskills.io。

## 共通(Markdown の書き方)

- 見出しと箇条書きで構造化する。並列データは表にする。段落で説明しない
- 検証できる具体性で書く(「整形する」ではなく「2 スペースインデント」、「テストする」ではなく「`npm test` を実行」)
- 1 概念 1 用語。同じものを別名で呼ばない
- 強調(**太字** / IMPORTANT)は本当に守らせたい 1 行だけに使う。多用すると効かない
- 矛盾する規則を複数ファイルに置かない。見つけたら片方を消す
- 規則には理由を添える(「X しない」より「Y のため X しない」)。Claude 5 系は理由から一般化し、理由の無い絶対規則は矛盾したとき無視されやすい
- 絶対規則(禁止)は安全と不可逆操作に限る。それ以外は望ましい状態を記述する(「コメントを書くな」ではなく「周囲のコメント密度に合わせる」)
- パスに言及するだけならコードスパンで書く。行頭の裸の `@path` は読み込み指示として解釈される
- 人間向けの保守メモはブロック HTML コメントに書く(CLAUDE.md では context から除去される)
- パス区切りは `/` だけを使う

## 置き場所の判断

| 書きたいこと | 置き場所 |
| ------------ | -------- |
| 毎セッション必要で、どのエージェントにも通じる規則(原則・品質基準・Git・セキュリティ) | `AGENTS.md` |
| 他エージェントの利用可否・役割・書込範囲(人間が決める) | `project-config.md` §13.7 |
| 毎セッション必要な Claude Code 固有の事実(skill・team・フック・権限) | `CLAUDE.md`(`AGENTS.md` と合わせて 200 行以内) |
| 特定パスでだけ効く規約 | `.claude/rules/*.md` + `paths:` |
| 手順・チェックリスト・長い参照 | skill(本文は手順、詳細は `references/`) |
| 「毎回必ず X」「絶対に Y しない」 | フック / `permissions.deny`(指示ではなく強制) |
| 文脈を汚す調査・独立したレビュー | subagent |
| 数十の agent を回す網羅・反証 | `.claude/workflows/*.js` |

## CLAUDE.md

- 各行を「消すと Claude が間違えるか?」で判定する。コードから読めること・一般常識は書かない
- `@import` 先は毎セッション全文 load される。常時必要なファイルだけを import する
- CLAUDE.md が 1 つでもあると Claude Code は `AGENTS.md` を直接読まない。CLAUDE.md の冒頭の `@AGENTS.md` を消さず、共通ルールを CLAUDE.md に複製しない。例外は安全に関わる禁止事項で、auto mode の分類器に届くよう CLAUDE.md 本体にも置く
- `AGENTS.md` には行頭 `@` を書かない(Claude Code 以外は import を解釈しない)。常時読ませたいファイルはパスを本文で示す

## skill(SKILL.md)

- `description` は「何をするか」+「いつ使うか(ユーザーが実際に使う語)」。三人称で主用途を先頭に置き、1024 字以内(目安 300 字)
  - 一覧の予算は context の 1%。溢れると使用頻度の低い skill から説明が落ちる。制約や引数の説明は本文と `argument-hint` に置く
- 本文は起動後ずっと context に残る。Claude が既に知っている説明は書かず、やることを命令形で書く。500 行以内
- 最重要の指示は本文の冒頭に置く。コンパクト後の再注入は skill ごとに先頭 5,000 トークンで切り詰められる
- 手順は順序が重要なときだけ番号付きにする。「慎重に考えろ」「推論を示せ」「念のため再確認せよ」は Claude 5 系では過剰な検証と思考の開示を招くので書かない
- レビュー系 skill に「重大なものだけ報告」「控えめに」と書かない。全件報告させ、重要度分類と対応方針で絞る
- 特定パスの作業でだけ候補にしたい skill には `paths:` を付ける(一覧予算の節約)
- **行頭に `@path` を書かない**。ローカル skill では起動時にそのファイルが丸ごと添付される。
  参照は「`.claude/pitfalls.md` — 失敗パターンに当たりそうなとき」のように、パスと読む条件の組で並べる
- 詳細は `references/` に分け、SKILL.md から 1 階層で直接リンクする。参照ファイルから別の参照ファイルへ飛ばさない
- 100 行を超える参照ファイルは冒頭に目次を置く
- 日付つきの記述を書かない。変わりうる事項は「旧方式」節に分ける
- 複雑な手順はコピーして使えるチェックリストにし、「検証 → 修正 → 再検証」のループを明記する
- 出力形式はテンプレートで示す。文体が重要なら入力と出力の例を 2〜3 組置く
- 副作用のあるワークフロー(push・デプロイ)には `disable-model-invocation: true` を付ける
- skill を編集したら `/skill-doctor`(一覧コストと使用頻度)を見る。モデル更新のたびに `/doctor prompt-audit` で旧世代向けの書き方・存在しない参照・矛盾を洗う

## skill の eval(eval-first)

- 各 skill に `evals/evals.json`(agentskills.io 形式)を置く。2〜3 ケースから始める
  - `prompt` は実際の依頼文(ファイルパスや口語を含む)、`expected_output` は成功の説明、`assertions` は出力から検証できる文
  - 1 件は典型的な依頼、1 件は境界(曖昧な入力や禁止事項を誘う依頼)にする
- 実行は saved workflow `/skill-eval skill=<名>`。同じ prompt を skill あり / なしで回し、実行していない別 agent が assertions を判定する
  - 出力先: `testreport/evals/<skill>/iteration-N/`(gitignore 対象)
  - dynamic workflows を使わない環境では skill-creator プラグイン(`/plugin install skill-creator@claude-plugins-official`)で同じ `evals.json` を回せる
  - プラグインとして配布する場合は `claude plugin eval`(evals.json とは別形式)で CI のゲートにできる
- skill を変えたら同じ eval を再実行し、pass rate が下がっていないことを証拠に残す
- 既存ケースは回帰 eval(pass rate ほぼ 100% を維持)。新しい難しいケースは低い pass rate から始めて改善に使い、安定したら回帰側に昇格させる

## agent(.claude/agents/*.md)

- `description` は委譲条件を 1〜2 文で書く。`tools` は最小にする
- 書込可能な agent は、frontmatter の `hooks.PreToolUse` に `scope-guard.sh <docs|output|tests>` を登録して書込範囲を強制する
- agent の `tools` に `Agent` を含めない(constitution ④)。入れ子は `settings.json` の env `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` で機械的に禁じている。並列 fan-out は workflow に置く
- CLAUDE.md の規則を要さない読取専用 agent には `omitClaudeMd: true` を付けて起動コストを下げる(書込 agent には付けない)
- 完了直前の仕様照合は `verifier`(読取専用・fresh context)に差分と仕様だけを渡す。実装途中の再確認に subagent を使わない(過剰検証)

## hooks(settings.json)

- ツール系イベント(PreToolUse / PostToolUse / PostToolUseFailure / PermissionRequest / PermissionDenied)では `if` で対象を絞る(例 `"if": "Bash(git commit *)"`)。best-effort なので安全用途は `permissions.deny` と matcher 全体のフックに置く
- コンパクト後の再注入は SessionStart の `compact` source で行う(PostCompact は文脈注入できない)
- `paths:` 付き rule はコンパクトで要約に溶ける。常に効かせたい規則は CLAUDE.md か `paths:` なしの rule に置く
- ブロック系のフック(deny と二重化する安全装置)には `onFailure: block` を付ける。無いと、フックが起動できないときに操作が素通りする
- `/skill` の直接入力は PreToolUse(Skill) を通らない。skill 単位の抑止は `UserPromptExpansion` にも同じスクリプトを登録する
- フックは「例外が 1 つも無い規則」にだけ使う。好み(命名・スタイル)を符号化したフックは消して CLAUDE.md の記述に戻す。強制は少数に保つ(40 個に近づいたら大半は好み)

## workflow(.claude/workflows/*.js)

- 先頭の文は `export const meta = {...}` にする。純粋なリテラルだけで書き、変数・関数呼び出し・テンプレート文字列を使わない
- `meta.phases` のタイトルと、本文の `phase()` / `{phase: ...}` を一致させる
- `Date.now()` / `Math.random()` / 引数なしの `new Date()` / `import` は使えない。時刻は agent 側で取得する
- 件数を絞る(上位 N 件・票数)ときは、落とした件数を `log()` で出す

## 変更後の確認

テンプレート元リポジトリでは `bash scripts/validate-harness.sh` が frontmatter・参照・eval 形式・workflow 規約を機械検査する。
