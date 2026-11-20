# プロジェクト情報

> 実装に合わせて更新する。

## 概要

**Lexigrep** — 日本語圏の IT エンジニアが、英語の公式ドキュメント・エラーメッセージ・SaaS UI を翻訳なしで読めるようになるための、
モバイルファーストの英語パターン学習アプリ。題材サイトの実文からカードを作り、FSRS の間隔反復で 1 日 3〜7 分の学習に収める。
アプリのコードは題材を知らない。題材に依存する文言(アプリ名・説明・ベースコース名・紹介ページの見本)は repo 直下の `site.config.ts` に置き、題材は `content/` のデータとして足す(skill `/author-subject`)。

設計原則: ①プラットフォームとコンテンツの分離(アプリは特定題材を知らない) ②モバイルファースト
③セッションは 3〜7 分 ④実文に紐づく学習(カードは必ず出典 URL を持つ) ⑤サイト自体が題材(TypeScript / Next.js / Playwright / Vitest)の実例。

## コマンド

```bash
pnpm dev                      # 開発サーバー(http://localhost:3000)
pnpm build                    # 本番ビルド
pnpm start                    # 本番起動
pnpm lint                     # ESLint
pnpm typecheck                # next typegen + tsc --noEmit
pnpm format / format:check    # Prettier
pnpm test                     # Vitest 一回実行
pnpm test:watch               # Vitest watch
pnpm test:coverage            # カバレッジ(testreport/coverage/)
pnpm e2e                      # Playwright(memory モードで dev サーバーを自動起動、port 3100)
pnpm e2e:ui                   # Playwright UI
pnpm check                    # lint + typecheck + test
pnpm content:init --subject <id> --name <名前> --category <slug> --url <root>  # 題材の雛形を作る(既存なら拒否)
pnpm content:validate [subject] [--write-manifest]   # 題材パッケージ検証 / manifest 生成
pnpm content:review <subject> [--reviewer 名前] [--publish]  # カードレビュー CLI
pnpm content:import <subject> [--dry-run] [--force]  # Supabase へ投入(SUPABASE_SERVICE_ROLE_KEY)
pnpm pipeline:crawl --subject <id> [--root url] [--max-pages 150] [--delay 1000]
pnpm pipeline:frequency --subject <id> [--top 300]
pnpm pipeline:generate --subject <id> [--limit 40] [--dry-run]   # ANTHROPIC_API_KEY
pnpm pipeline:verify --subject <id> [--soft]                      # 実文の照合
pnpm pipeline:author --subject <id> --spec pipeline/specs/<id>.json [--out <jsonl>]   # 執筆スペック + コーパスからカードを起こす
```

## 技術スタック

| カテゴリ       | 技術                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| フレームワーク | Next.js 16.4(App Router, Turbopack, `src/proxy.ts`)、React 19.3、TypeScript 5.9(`strict`)                |
| スタイリング   | Tailwind CSS 4(`@tailwindcss/turbopack`)。デザイントークンは `src/app/globals.css`                       |
| フォント       | 本文はシステムフォント、実文のみ Geist Mono(`geist` パッケージ、ビルド時のネットワーク不要)              |
| 状態管理       | クライアントストアなし。サーバー側リポジトリ + Server Functions。セッション画面のみ `useState`           |
| バリデーション | Zod 4(`src/shared/content/schema.ts` が唯一の定義源)                                                     |
| 認証 / DB      | Supabase Auth(Google OAuth)+ PostgreSQL(RLS)。`@supabase/ssr` 0.12 / `@supabase/supabase-js` 2.118       |
| SRS            | ts-fsrs 6(FSRS-7)                                                                                        |
| テスト         | Vitest 5(jsdom / node)、`@electric-sql/pglite`(SQL・RLS 検証)、Playwright 1.64(Pixel 7 エミュレーション) |
| コード品質     | ESLint 9(`eslint-config-next` + prettier 無効化)、Prettier 3(+ tailwind plugin)                          |
| Git Hooks      | husky + lint-staged(pre-commit: eslint --fix / prettier、pre-push: typecheck + test)                     |
| コンテンツ生成 | `@anthropic-ai/sdk`、cheerio、robots-parser(`pipeline/`)                                                 |
| ホスティング   | Vercel(想定)。CI は GitHub Actions(`.github/workflows/ci.yml`)                                           |

## ルーティング

| パス                                                              | ページ         | 機能                                                                                                     |
| ----------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `/login`                                                          | ログイン       | Google ログイン(supabase)/ デモユーザー(memory)。`?next=` はサイト内相対パスのみ                         |
| `/about`                                                          | 紹介・使い方   | ログイン不要。特長、カードの見本(`site.config.ts` の `sample`)、使い方、層の説明、題材の追加、クレジット |
| `/auth/callback`                                                  | Route Handler  | OAuth(PKCE)の code をセッションに交換                                                                    |
| `/`                                                               | ホーム         | 学習目的の切替(IT 英語全般 / 題材を絞る)、今日のセッション、語句単位の進捗(ベース 3 層 + 題材の特有語)   |
| `/session?course=&subject=&layer=`                                | 学習セッション | 1 カード 1 画面(実文→設問→即時フィードバック→解説)。回答ごとに SRS 保存、完了時に学習ログ保存            |
| `/dictionary?q=`                                                  | 辞書           | 語句・日本語の意味で検索(サジェスト)、層・題材で絞り込み                                                 |
| `/dictionary/[term]`                                              | 語句の詳細     | 語句の意味と題材をまたいだ実文の一覧                                                                     |
| `/subjects`                                                       | 題材ブラウザ   | 題材一覧と定着率・未学習数                                                                               |
| `/subjects/[subjectId]`                                           | 題材詳細       | 層ごとの進捗と学習導線、カード一覧(頻度順)                                                               |
| `/cards/[cardId]`                                                 | カード詳細     | 実文・出典・設問・学習状態・関連パターン・間違い報告                                                     |
| `/dashboard`                                                      | 記録           | 連続日数、正答率(30 日)、定着/学習済、14 日の活動、題材別、最近のセッション                              |
| `/settings`                                                       | 設定           | セッション枚数(8/12/16/20)、テーマ(system/dark/light)、ログアウト、アカウント削除                        |
| `/manifest.webmanifest`, `/icon/{32,192,512,512m}`, `/apple-icon` | PWA            | manifest と生成アイコン                                                                                  |

`(app)` ルートグループと `/session` が下部のアイランドナビ付き。`/login` と `/about` はナビなし。

## リポジトリ / ストア一覧

| インターフェース     | 責務                                                               | 実装                                                                                  |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `ContentRepository`  | 公開済み題材・カード(出典込み)の読み取り                           | `MemoryContentRepository` / `SupabaseContentRepository`                               |
| `LearningRepository` | SRS 状態・学習ログ・設定・間違い報告・アカウント削除(ユーザー単位) | `MemoryLearningRepository` / `LocalLearningRepository` / `SupabaseLearningRepository` |
| `AuthGateway`        | 現在ユーザー、ログイン開始、ログアウト                             | `MemoryAuthGateway`(Cookie の UUID = ユーザー) / `SupabaseAuthGateway`                |

`getRepositories()`(`src/infrastructure/repositories/index.ts`)がリクエストごとに組み立てる。データソースは
`LEXIGREP_DATA_SOURCE=supabase|memory|local`、未指定なら Supabase の環境変数があれば supabase、無ければ memory。
`local` は memory と同じデモユーザー(認証なし)で、学習データだけを JSON ファイルに保存して再起動後も残す(手元専用)。
memory / local は本番ビルドでは既定で拒否し、`LEXIGREP_ALLOW_MEMORY=1` で許可する。

## 環境変数

| 変数                                                                | 用途                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `LEXIGREP_DATA_SOURCE`                                              | `supabase` / `memory` / `local`                                                     |
| `LEXIGREP_LOCAL_DATA`                                               | local モードの保存先(既定 `.lexigrep/learning.json`、gitignore)                     |
| `LEXIGREP_CONTENT_DIR`                                              | memory モードが読む題材ディレクトリ(既定 `content/`。E2E は `e2e/fixtures/content`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase(旧 `NEXT_PUBLIC_SUPABASE_ANON_KEY` も可)                                   |
| `NEXT_PUBLIC_SITE_URL`                                              | OAuth コールバックの origin(未設定時はリクエストヘッダから推定)                     |
| `SUPABASE_SERVICE_ROLE_KEY`                                         | `scripts/import-subject.ts` のみ。アプリには渡さない                                |
| `ANTHROPIC_API_KEY`                                                 | `pipeline/generate.ts` のみ                                                         |

## 制約事項

- パスエイリアス: `@/*` → `src/*`
- E2E テスト: `e2e/`。Chromium(Pixel 7)。`LEXIGREP_DATA_SOURCE=memory` + フィクスチャ。テストごとに別 UUID の Cookie でユーザーを分離
- Git Hooks: husky(pre-commit: lint-staged / pre-push: `pnpm typecheck && pnpm test`)。フックの迂回は禁止
- Node.js 22 以上(`engines`)。パッケージマネージャーは pnpm 10
