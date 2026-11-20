# ADR-002: マイグレーションと RLS の検証に PGlite を使う

- ステータス: Accepted
- 日付: 2026-11-01
- 関連: `supabase/migrations/0001_init.sql`、`supabase/test/`

## 背景

RLS ポリシーの誤りは「他人のデータが見える / 自分のデータが書けない」という致命的な不具合になるが、
開発環境に Docker デーモンも Supabase CLI も無い状態で検証手段が必要だった。

## 決定

- `@electric-sql/pglite`(WASM の PostgreSQL)を devDependency に入れ、Vitest から本物の SQL を適用する
- Supabase が提供する `auth.users` / `auth.uid()` / `anon` / `authenticated` / `service_role` は `supabase/test/auth-stub.sql` で最小限に模す
- テストは `set role authenticated` + `request.jwt.claim.sub` でユーザーを切り替え、閲覧範囲・書込制限・カスケード削除を検証する

## 代替案

- Docker の PostgreSQL — 環境依存。CI では使えるが手元で動かない場合がある
- Supabase CLI(`supabase start`) — 最も忠実だが起動が重い。Phase 1 の結合確認で別途使う

## 影響

- `auth.uid()` の実装は Supabase 本体と完全には一致しない(JWT 検証は模していない)。ポリシー式の論理だけを検証していると理解して使う
- マイグレーションを増やすときは `supabase/migrations/` に連番ファイルを追加するだけでテストが追随する
