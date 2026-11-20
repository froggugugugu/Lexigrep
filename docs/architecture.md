# アーキテクチャ

> 実装に合わせて更新する。設計判断の経緯は `docs/adr/`。

## エントリーポイント

- `src/app/layout.tsx` — ルートレイアウト。テーマ Cookie(`lexigrep-theme`)とタイムゾーン Cookie(`lexigrep-tz`)を読む
- `src/app/(app)/layout.tsx` — 下部ナビ付きレイアウト(ホーム / 題材 / 辞書 / 記録 / 設定)
- `src/proxy.ts` — Supabase セッション Cookie の更新のみ(認可は各ページの `requireUser()`)
- `src/infrastructure/repositories/index.ts` — `getRepositories()`(データソースの組み立て)

## ディレクトリ構成

```text
src/
├── app/                      # ルーティング(App Router)
│   ├── (app)/                #   下部ナビ付き: page(ホーム) / subjects / cards / dashboard / settings
│   ├── session/              #   学習セッション
│   ├── login/, auth/callback/
│   ├── about/                #   紹介・使い方(ログイン不要)
│   └── layout.tsx, globals.css, manifest.ts, icon.tsx, apple-icon.tsx, error.tsx, not-found.tsx
├── features/                 # 機能モジュール(サーバー処理 + クライアント部品)
│   ├── auth/                 #   requireUser / signIn・signOut actions / safe-path
│   ├── session/              #   build-session(純粋) / course(純粋) / shuffle(純粋) / queries / actions / SessionRunner(client)
│   ├── dictionary/           #   search(純粋) / DictionarySearch(client)
│   ├── srs/                  #   scheduler(ts-fsrs ラッパー、純粋)
│   ├── dashboard/            #   stats(純粋) / queries
│   ├── cards/                #   間違い報告 action + ReportForm
│   └── settings/             #   theme / actions / SettingsForm / DeleteAccountButton / TimezoneSync
├── infrastructure/
│   ├── repositories/         #   インターフェース(types.ts)と factory(index.ts)
│   ├── memory/               #   store(content/ 読み込み) / repositories / auth
│   ├── local/                #   store(学習データの JSON 保存) / repositories(memory + 保存)
│   └── supabase/             #   env / server client / proxy-session / rows(行変換) / repositories / auth
├── shared/
│   ├── content/              #   schema.ts(Zod、唯一の定義源) / package.ts(JSONL・manifest)
│   ├── site/                 #   config.ts(site.config.ts の検証)
│   └── ui/                   #   Button / Surface / Badge / ProgressBar / PageHeader / EmptyState / HighlightedSentence / BottomNav / SiteCredit / labels
├── proxy.ts
└── test/setup.ts
supabase/
├── migrations/               # 0001_init(テーブル・制約・RLS・delete_my_account())/ 0002_learning_goal / 0003_subject_category_text
└── test/                     # auth-stub.sql / pglite.ts / migrations.test.ts
content/<subject>/            # subject.json / cards.jsonl / manifest.json(題材パッケージ)
pipeline/                     # crawl / frequency / generate / verify / author / review + lib/(純粋ロジック)
pipeline/specs/<subject>.json # 執筆スペック(語句・意味・選択肢。実文と出典はコーパスから選ぶ)
scripts/                      # init-subject / validate-content / import-subject + lib/(純粋ロジック)
site.config.ts                # 題材に依存する文言(アプリ名・説明・ベースコース名・紹介ページの見本)
content/NOTICE.md             # 同梱カードの出典と権利
docs/adr/                     # 設計判断の記録(ADR)
e2e/                          # Playwright specs + fixtures/content
```

### 依存方向

`app → features → infrastructure(interface) / shared`、`infrastructure → shared`、`shared → なし`。
`features` は `app` を import しない。`infrastructure` は `features` を import しない(SRS 状態型は `shared/content/schema.ts` に置く)。
`pipeline` / `scripts` は `src/shared` と `src/infrastructure/supabase/rows` だけを import する。

### サーバー / クライアント境界

- Server Components が既定。`"use client"` は `SessionRunner` / `DictionarySearch` / `SettingsForm` / `ReportForm` / `DeleteAccountButton` / `BottomNav` / `TimezoneSync` / `error.tsx` のみ
- 書込は Server Functions(`features/*/actions.ts`、`"use server"`)。Zod で入力検証し `requireUser()` を先頭で呼ぶ
- `server-only` を import するモジュール(`requireUser`、`getRepositories`、`queries.ts` 等)は Vitest から読まない。純粋ロジックは別ファイルに分ける

## テスト構成

ユニットテストはコロケーション(`*.test.ts` を対象と同じディレクトリ)。E2E は `e2e/`。

### 純粋ロジック(Vitest)

| テストファイル                               | 対象                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| `src/shared/content/schema.test.ts`          | カード / 選択肢 / 題材 / manifest のスキーマ検証         |
| `src/shared/content/package.test.ts`         | JSONL パース、パッケージ整合性、manifest 生成と checksum |
| `src/features/srs/scheduler.test.ts`         | FSRS 写像、間隔の伸び、決定論、純粋性、往復変換          |
| `src/features/session/build-session.test.ts` | due 優先・頻度順・枚数・絞り込み・決定論                 |
| `src/features/session/shuffle.test.ts`       | 決定論的シャッフル                                       |
| `src/features/dashboard/stats.test.ts`       | ローカル日付、連続日数、題材別進捗、日別活動、正答率     |
| `src/features/auth/safe-path.test.ts`        | オープンリダイレクト防止                                 |
| `src/features/settings/theme.test.ts`        | テーマ / タイムゾーンの検証                              |
| `src/shared/site/config.test.ts`             | `site.config.ts` の検証(見本の実文が語句を含むこと)      |
| `src/shared/ui/labels.test.ts`               | カテゴリの表示名(指定 → 既知 → 値)                       |

### インフラ(Vitest)

| テストファイル                                        | 対象                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `src/infrastructure/memory/repositories.test.ts`      | memory リポジトリ(公開判定、ユーザー分離、ログ、設定、削除)        |
| `src/infrastructure/local/store.test.ts`              | local の保存と再読込、壊れたファイルを上書きしない、同時書込、削除 |
| `src/infrastructure/supabase/rows.test.ts`            | int4range と行変換の往復                                           |
| `src/infrastructure/repositories/data-source.test.ts` | データソースの決定(memory / local / supabase、本番での拒否)        |
| `supabase/test/migrations.test.ts`                    | PGlite でマイグレーション適用、制約、RLS、アカウント削除           |

### パイプライン(Vitest)

| テストファイル                       | 対象                                               |
| ------------------------------------ | -------------------------------------------------- |
| `pipeline/lib/text.test.ts`          | HTML→文、文分割、トークン化、n-gram、コーパス照合  |
| `pipeline/lib/crawler.test.ts`       | ルート制限、robots.txt、レート制限、maxPages       |
| `pipeline/lib/generate-core.test.ts` | 応答検証、実文照合、カード組み立て、統合、対象選定 |
| `pipeline/lib/review-ops.test.ts`    | 承認 / 修正 / 却下 / 公開                          |
| `scripts/lib/init-subject.test.ts`   | 題材の雛形(検証を通る、既存は拒否、不正値の拒否)   |

### E2E(Playwright、memory モード)

| テストファイル            | 対象                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `e2e/auth.spec.ts`        | 未ログインのリダイレクト、紹介ページ(`/about`)、デモログイン / ログアウト、`next` の安全性              |
| `e2e/session.spec.ts`     | ログイン → セッション完了(不正解の再出題を含む)→ ダッシュボード反映、絞り込み、fill_blank、空セッション |
| `e2e/browse.spec.ts`      | 題材一覧 → 詳細 → カード詳細 → 間違い報告、404、設定保存、PWA manifest                                  |
| `e2e/screenshots.spec.ts` | `E2E_SCREENSHOTS=1` のときだけ主要画面を `testreport/screenshots/` に保存                               |

## ドキュメント責務

| ファイル                       | 責務                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `docs/project.md`              | ルート定義、リポジトリ一覧、コマンド、技術スタック、環境変数 |
| `docs/architecture.md`         | ディレクトリ構成、依存方向、テスト一覧、ドキュメント責務     |
| `docs/data-model.md`           | スキーマ定義、DB テーブル、バリデーションルール              |
| `docs/development-patterns.md` | コード規約、落とし穴、E2E パターン、デザインシステム         |
| `docs/adr/NNN-*.md`            | 設計判断の経緯(ADR-001〜007)。新しい ADR もここに置く        |
| `docs/ui-glossary.md`          | UI の文言・アイコン・書式の標準                              |
