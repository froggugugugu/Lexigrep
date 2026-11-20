# データモデル

> 定義源は `src/shared/content/schema.ts`(Zod)。DB は `supabase/migrations/`(0001〜0003)がこれと 1:1 に対応する。
> AI がスキーマ変更と同期して更新する。

## スキーマ配置

| 場所                                  | 内容                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/shared/content/schema.ts`        | Subject / Source / Card / Manifest / SrsState / ReviewState / SessionLog / UserSettings / CardReport             |
| `src/infrastructure/supabase/rows.ts` | DB 行 ⇔ ドメイン型(int4range、card_sources の結合)                                                               |
| `supabase/migrations/`                | 0001: 列挙型、テーブル、制約、トリガー、RLS、`delete_my_account()` / 0002: 学習の目的 / 0003: カテゴリを text に |
| `content/<subject_id>/`               | 題材パッケージ(`subject.json` / `cards.jsonl` / `manifest.json`)                                                 |

## 列挙

| 名前             | 値                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `card_layer`(層) | `vocab`(頻出単語)/ `pattern`(表現パターン)/ `idiom`(慣用句・定型句)/ `system_term`(題材特有語) |
| `question_type`  | `choose_meaning` / `fill_blank` / `recognize_pattern` / `next_action`                          |
| `card_status`    | `draft` → `reviewed` → `published` / `retired`                                                 |
| `review_state`   | `new` / `learning` / `review` / `relearning`                                                   |
| `theme`          | `system` / `dark` / `light`                                                                    |

## スキーマ詳細

### Subject(題材)— `subjects`

| フィールド     | 型                                            | 備考                                                                                                                        |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| id             | text(slug `^[a-z0-9]+(-[a-z0-9]+)*$`)         | PK。題材横断の共通語彙は `common`(予約)                                                                                     |
| name           | text(1〜80)                                   | 表示名                                                                                                                      |
| category       | text(slug `^[a-z0-9]+([_-][a-z0-9]+)*$`、≤40) | 自由な slug。既知の値(`genai` / `language_fw` / `cloud` / `idp` / `testing`)は表示名を持つ。`0003` で enum から text に変更 |
| category_label | text(1〜40)/ null                             | カテゴリの表示名。null なら既知の表示名、それも無ければ値そのもの(`categoryLabel()`)                                        |
| description_ja | text(1〜200)                                  | 題材ブラウザの 1 行説明                                                                                                     |
| official_urls  | url[](1 件以上)                               | クロール対象のルート                                                                                                        |
| license_note   | text(≤1000、既定 "")                          | 引用方針・帰属の表示                                                                                                        |
| version        | int ≥ 1                                       | 再クロールで増える                                                                                                          |
| crawled_at     | timestamptz / null                            |                                                                                                                             |
| is_published   | bool                                          | 未公開題材は authenticated から見えない                                                                                     |

### Card(カード)— `cards` + `card_sources`

| フィールド              | 型                                             | 備考                                                                                          |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| id                      | uuid                                           | PK                                                                                            |
| subject_id              | text                                           | FK → subjects(cascade)                                                                        |
| layer                   | card_layer                                     |                                                                                               |
| target                  | text(1〜120)                                   | 学習対象の語句                                                                                |
| sentence                | text(1〜400)                                   | 実文(文単位の短い引用)                                                                        |
| highlight               | `{start, end}` / DB は `int4range [start,end)` | `sentence.slice(start,end) === target` を Zod と DB CHECK の両方で強制                        |
| meaning_ja              | text(1〜200)                                   |                                                                                               |
| note_ja                 | text(≤600) / null                              | 訳語 + 1 文の補足                                                                             |
| question_type           | question_type                                  |                                                                                               |
| prompt_ja               | text(≤200) / null                              | 設問文の上書き(既定は `QUESTION_PROMPTS`)                                                     |
| choices                 | `{options: string[2..6], answer: int}`         | options 重複不可、answer は範囲内(Zod + DB CHECK)                                             |
| frequency_rank          | int ≥ 1                                        | 出題順の基礎                                                                                  |
| related_card_ids        | uuid[]                                         | 自分自身を含めない                                                                            |
| generated_by            | text                                           | `claude-<model>` / `human`                                                                    |
| reviewed_by             | text / null                                    | draft 以外は必須(Zod + DB CHECK)                                                              |
| status                  | card_status                                    |                                                                                               |
| sources                 | Source[](1 件以上)                             | DB では `card_sources`(card_id, url, title, fetched_at, attribution)。`(card_id, url)` unique |
| created_at / updated_at | timestamptz                                    | updated_at はトリガーで更新                                                                   |

派生型: `CardDraftInput`(id / 日時 / status / reviewed_by / related を除いた生成入力)、`CardRow` / `CardInsertRow`(DB 行)。

### Manifest — `content_imports`(投入履歴)

| フィールド              | 型         | 備考                                                                                  |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------- |
| subject_id, version     |            |                                                                                       |
| card_count              | int ≥ 0    | cards.jsonl の行数と一致必須                                                          |
| checksum                | sha256 hex | cards.jsonl の内容と一致必須(不一致なら投入拒否)                                      |
| generated_at, generator |            | 例: `validate-content@0.1.0` / `review@owner` / `pipeline:generate@claude-sonnet-5-5` |

### SrsState / ReviewState — `review_states`(PK: user_id, card_id)

| フィールド                            | 型                 | 備考                  |
| ------------------------------------- | ------------------ | --------------------- |
| stability, stability_fast, difficulty | float ≥ 0          | FSRS-7(ts-fsrs 6)の値 |
| due_at                                | timestamptz        | 次回出題              |
| last_reviewed_at                      | timestamptz / null |                       |
| reps, lapses                          | int ≥ 0            |                       |
| state                                 | review_state       |                       |
| scheduled_days                        | float ≥ 0          | 予定間隔(日)          |
| learning_step                         | int ≥ 0            |                       |

定着判定: `state = review` かつ `stability ≥ 21`(`MASTERY_STABILITY_DAYS`)。

### SessionLog — `session_logs`

| フィールド           | 型                                 | 備考                                                          |
| -------------------- | ---------------------------------- | ------------------------------------------------------------- |
| id, user_id          | uuid                               |                                                               |
| started_at, ended_at | timestamptz                        | `ended_at ≥ started_at`                                       |
| subject_id           | text / null                        | セッションの絞り込み(null = 全題材)。FK は on delete set null |
| layer                | card_layer / null                  |                                                               |
| card_results         | `{card_id, correct, elapsed_ms}[]` | 最初の回答のみ(再出題は含めない)                              |

### UserSettings — `user_settings`(PK: user_id)

| フィールド       | 型                          | 備考                                                              |
| ---------------- | --------------------------- | ----------------------------------------------------------------- |
| session_size     | int 8〜20(UI は 8/12/16/20) | 既定 12                                                           |
| theme            | theme                       | 既定 system。Cookie `lexigrep-theme` にも保存                     |
| learning_goal    | `general` / `subject`       | 学習の目的。既定 general(IT 英語ベース)。`0002_learning_goal.sql` |
| focus_subject_id | text / null                 | subject のときの題材。FK は on delete set null                    |

### CardReport — `card_reports`

| フィールド       | 型            | 備考             |
| ---------------- | ------------- | ---------------- |
| user_id, card_id | uuid          |                  |
| reason           | text(1〜1000) | 間違い報告の本文 |

## RLS / 権限

| テーブル                                     | authenticated                                        | anon | service_role         |
| -------------------------------------------- | ---------------------------------------------------- | ---- | -------------------- |
| subjects / cards / card_sources              | `is_published` かつ `status = published` のみ select | 不可 | 全権(投入スクリプト) |
| content_imports                              | 不可                                                 | 不可 | 全権                 |
| user_settings / review_states / session_logs | 本人行のみ全操作(`user_id = auth.uid()`)             | 不可 | 全権                 |
| card_reports                                 | 本人行のみ insert / select                           | 不可 | 全権                 |

`public.delete_my_account()`(security definer)が `auth.users` の本人行を削除し、cascade で全データを消す。

## フォームバリデーション(Server Functions)

| スキーマ              | 対象                    | 主なルール                                                       |
| --------------------- | ----------------------- | ---------------------------------------------------------------- |
| `answerInputSchema`   | `answerCardAction`      | cardId uuid、answer ∈ correct / incorrect                        |
| `completeInputSchema` | `completeSessionAction` | startedAt ISO、subjectId slug/null、layer/null、results ≤ 100 件 |
| `settingsInputSchema` | `saveSettingsAction`    | session_size ∈ {8,12,16,20}、theme                               |
| `reportInputSchema`   | `reportCardAction`      | reason 1〜1000 文字(trim)                                        |

## 重要なバリデーションルール

- カードは出典 1 件以上が必須(実文に紐づく学習の原則)
- `highlight` と `target` の一致を Zod と DB CHECK で二重に強制する(投入経路に依らず壊れたデータを拒否)
- `manifest.checksum` が `cards.jsonl` と一致しないパッケージは読み込み拒否(レビュー後の再生成を強制)
- draft 以外のカードは `reviewed_by` 必須(自動公開を防ぐ)

## ユーティリティ関数

| 関数                                                                                               | 場所                                    | 用途             |
| -------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------- |
| `parseCardsJsonl` / `validatePackage` / `readPackage` / `writeManifest` / `serializeCards`         | `src/shared/content/package.ts`         | パッケージ入出力 |
| `parseInt4Range` / `formatInt4Range` / `rowToCard` / `cardToRows`                                  | `src/infrastructure/supabase/rows.ts`   | DB 行変換        |
| `newSrsState` / `reviewCard` / `isDue` / `isMastered`                                              | `src/features/srs/scheduler.ts`         | SRS              |
| `buildSession` / `estimateMinutes`                                                                 | `src/features/session/build-session.ts` | セッション生成   |
| `toLocalDate` / `computeStreak` / `computeSubjectProgress` / `computeDailyActivity` / `accuracyOf` | `src/features/dashboard/stats.ts`       | 集計             |
