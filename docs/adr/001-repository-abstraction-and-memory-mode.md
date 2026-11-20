# ADR-001: リポジトリ抽象と memory モード(Supabase 非依存のデモ / E2E)

- ステータス: Accepted
- 日付: 2026-11-01
- 関連: `src/infrastructure/repositories/types.ts`、`src/infrastructure/memory/`、`src/infrastructure/supabase/`

## 背景

当初の設計方針は「Supabase へのアクセスはリポジトリ層に閉じ込め、UI から直接呼ばない」ことと
「学習セッションの主要フローは Playwright で E2E テスト必須」を求めている。一方、開発環境・CI には Supabase の認証情報が無く、
Google OAuth は自動テストで通せない。

## 決定

1. `ContentRepository` / `LearningRepository` / `AuthGateway` のインターフェースを定義し、UI(`src/app`, `src/features`)はこれだけに依存する
2. 実装を 2 種持つ
   - `memory`: プロセス内 Map。`content/<subject>/` を起動時に読み込み、Cookie の UUID をユーザー ID として扱う(認証不要)
   - `supabase`: `@supabase/ssr` のサーバークライアント。RLS が行単位の分離を保証する
3. データソースは `LEXIGREP_DATA_SOURCE`(未指定なら Supabase の環境変数の有無)で決める。`getRepositories()` がリクエストごとに組み立てる

## 代替案

- Supabase CLI でローカルスタックを起動して E2E する — Docker 依存が重く、CI の所要時間が伸びる。マイグレーションの検証は PGlite で代替した(ADR-002)
- テスト用に Supabase の email/password 認証を有効化する — 本番で使わない認証経路を増やすことになるため不採用

## 影響

- E2E はテストごとに別 UUID の Cookie を入れて並列実行できる
- memory モードは draft カードも表示する(レビュー前の内容を実アプリで確認する用途)。本番(supabase)は published のみ
- Supabase 実装の自動テストは行変換(`rows.ts`)と SQL(PGlite)に限られる。結合の確認は Supabase プロジェクトを用意してから行う
