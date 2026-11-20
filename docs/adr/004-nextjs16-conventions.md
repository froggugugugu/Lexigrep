# ADR-004: Next.js 16 の採用規約(Cache Components 無効・proxy・Server Actions)

- ステータス: Accepted
- 日付: 2026-11-01
- 関連: `next.config.ts`、`src/proxy.ts`、`src/features/*/actions.ts`

## 背景

`create-next-app@16.4` の既定は `cacheComponents: true`(Partial Prerendering)で、`cookies()` を読むページは Suspense 境界が必須になる。
本アプリはほぼ全ページがユーザー固有(認証 Cookie を読む)で、キャッシュの恩恵が小さい。

## 決定

- `cacheComponents: false`。各ページは `dynamic = "force-dynamic"` で明示的に動的レンダリングにする
- `middleware.ts` ではなく Next.js 16 の `src/proxy.ts` を使い、役割を **Supabase セッション Cookie の更新だけ** に限定する。認可は各ページ / Server Function の `requireUser()` が担う(matcher 漏れに依存しない)
- 書込はすべて Server Functions(`"use server"`)。入力は Zod で検証し、`requireUser()` を先頭で呼ぶ
- Server Component から Cookie は書けないため、テーマ Cookie の更新は Server Function(設定保存)で行う。`system` テーマは `<head>` のインラインスクリプトで解決する
- ルート型(`LayoutProps` 等)は `next typegen` 生成に依存するため使わず、props 型を明示する

## 影響

- ビルド成果物はほぼ全て `ƒ (Dynamic)`。静的最適化は manifest / icon のみ
- 将来 Cache Components を有効化する場合は、`cookies()` 読み取りを Suspense 境界内に閉じ込める改修が必要
