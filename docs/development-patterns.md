# 開発パターン集

プロジェクト固有のコード規約・落とし穴・アンチパターン。汎用的な知識は含めない。
ルート定義・ディレクトリ構成・スキーマは `docs/project.md`, `docs/architecture.md`, `docs/data-model.md`。

---

## 1. データアクセス

### 1.1 リポジトリ経由のみ

- UI / Server Function は `getRepositories()` から得た `content` / `learning` / `auth` だけを使う。`@supabase/*` を `src/app` / `src/features` で import しない
- `getRepositories()` と `requireUser()` は **リクエストごと**に呼ぶ(Supabase クライアントを共有しない)
- memory モードは `globalThis` に Symbol キーで退避したストアを使う(dev サーバーのモジュール再評価で消えないため)

### 1.2 Server Functions の型

```ts
"use server";
export async function fooAction(input: unknown): Promise<Result> {
  const parsed = schema.safeParse(input);           // 1. Zod で検証
  if (!parsed.success) return { ok: false, message: "入力が不正です" };
  const { user, repos } = await requireUser();      // 2. 認証(proxy に依存しない)
  ...                                               // 3. リポジトリ経由で読み書き
  revalidatePath("/");                              // 4. 影響するページを再検証
}
```

フォームは `useActionState<State, FormData>(action, initial)`。戻り値は `{ message, error }` の形に統一。

### 1.3 永続化パターン

- SRS 状態は **回答ごと**に upsert(途中離脱でも進捗が残る)。学習ログはセッション完了時に 1 件
- テーマは設定テーブルと Cookie(`lexigrep-theme`)の両方に保存。レイアウトは Cookie を読む(DB アクセスなしで描画)
- タイムゾーンは Cookie(`lexigrep-tz`)。`TimezoneSync` が端末の IANA 名を書く。未設定時は `Asia/Tokyo`

### 1.4 マイグレーション

- `supabase/migrations/NNNN_*.sql` に連番で追加する。`supabase/test/migrations.test.ts` が全ファイルを順に適用して検証する
- Zod スキーマ(`schema.ts`)→ SQL → `rows.ts` の順で同期する。制約は Zod と DB の両方に書く

---

## 2. Next.js 16 固有

- `middleware.ts` は非推奨。`src/proxy.ts`(`export function proxy`)を使う。役割はセッション Cookie 更新だけ
- `cookies()` / `headers()` / `params` / `searchParams` は **Promise**。`await` を忘れない
- Server Component から Cookie は書けない(Server Function / Route Handler のみ)
- `cacheComponents: false`。ユーザー固有ページは `export const dynamic = "force-dynamic"`
- `LayoutProps` / `PageProps` の生成型は使わず props 型を明示(`next typegen` 前でも tsc が通る)
- `app/icon.tsx` + `generateImageMetadata` の `id` は Promise(`await id`)
- `.next/dev/types/` に古いルートの型が残ると `tsc` が失敗する。ルートを削除したら `rm -r .next/dev` してから `pnpm typecheck`
- `next dev` は `AGENTS.md` 末尾に Next.js のエージェント向けブロックを追記する。消さずにコミットする(再生成されるため)

---

## 3. 数値精度・決定論

- FSRS は `enableFuzz: false`。同じ入力は同じ出力(テストで保証)
- 選択肢の並びは `shuffledOrder(cardId + startedAt)` で決める。サーバーで計算してクライアントへ渡す(SSR と一致)
- 「今日」はユーザーのタイムゾーンで決める(`toLocalDate`)。UTC の日付で連続日数を数えない
- 推定時間は 20 秒/枚、`Math.round`、最小 1 分

---

## 4. データモデル変更時の規約

### スキーマ追加

1. `src/shared/content/schema.ts` に Zod を追加(optional + 既定値で後方互換)
2. `supabase/migrations/` に SQL を追加、`rows.ts` の変換を更新
3. `docs/data-model.md` を更新。`content/*/cards.jsonl` に影響するなら `pnpm content:validate --write-manifest`

### スキーマ設計パターン

- 列挙は `as const` 配列 → `z.enum` → DB enum の順で 1 箇所から派生させる
- ユーザーデータは `user_id` を先頭キーにし、RLS は `(select auth.uid())` で比較する

---

## 5. UI 規約

### ダークモード

```tsx
// OK: セマンティックトークン(globals.css の @theme)
className="bg-surface text-foreground border-border text-muted"
// NG: 生の色
className="bg-gray-800"  /  style={{ color: "#fff" }}
```

既定はダーク。`[data-theme="light"]` でライト。`system` は `<head>` のインラインスクリプトが解決する(`suppressHydrationWarning`)。

### コンポーネント設計

- Server Component が既定。`"use client"` は対話が必要な最小単位(`SessionRunner` 等)だけ
- 共有 UI は `src/shared/ui/`(props のみ、ストア参照なし)。ラベル文言は `labels.ts` に集約
- 主要メニューは全画面で `BottomNav`(下に浮くアイランド)を使う。画面の下端の内容には `pb-island` を付けて隠れないようにする
- タップ領域は `min-h-tap`(44px)。回答操作は画面下半分(`sticky bottom-0`)に置く
- 等幅フォントは実文の `HighlightedSentence` だけに使う。他はシステムフォントで、数字の列は `tabular-nums` で揃える
- 実文は `HighlightedSentence`(`mark.lg-target`)。`fill_blank` は設問中だけ空欄

### アニメーション

正誤フィードバック(`.lg-feedback-enter`)と遷移に限定。`prefers-reduced-motion` で無効化。

---

## 6. E2E テストパターン

### テストデータ注入

- `playwright.config.ts` の webServer が `LEXIGREP_DATA_SOURCE=memory` と `LEXIGREP_CONTENT_DIR=e2e/fixtures/content` で dev サーバーを起動する
- フィクスチャ(`e2e/fixtures/content/*`)は正解インデックスをすべて 0 にしてある。追加するときも揃える
- テストごとに `signInAsDemo(page)` が別 UUID の Cookie(`lexigrep-demo-session`)を入れる → 並列実行でも学習状態が混ざらない
- ログインボタン経由を試すときだけ `signInViaButton(page, next?)`(固定のデモユーザー)

### UI 操作ヘルパー

- `answerCorrectly(page, answerIndex)` / `answerWrongly(page, answerIndex)`: `[data-testid="option"][data-option-index]` を押し、`feedback` の `data-correct` を確認
- ラジオは `sr-only` なので `locator("label", { hasText })` をクリックする(`check()` は不可視で失敗する)
- 主要要素の `data-testid`: `today-session` / `streak` / `session-runner` / `remaining` / `prompt` / `option` / `feedback` / `next` / `session-complete` / `session-saved` / `subject-list` / `layer-list` / `dashboard-*` / `recent-sessions` / `sign-out` / `demo-sign-in` / `google-sign-in`

### スクリーンショット

`E2E_SCREENSHOTS=1 pnpm e2e --grep screenshots` → `testreport/screenshots/`(gitignore)。

---

## 7. デザインシステム

### 7.1 参照するデザインシステム

| リソース     | URL                     | 用途                     |
| ------------ | ----------------------- | ------------------------ |
| 自前トークン | `src/app/globals.css`   | 色・フォント・タップ領域 |
| Geist Mono   | https://vercel.com/font | 実文の等幅表示のみ       |

### 7.2 カラートークン

`background` / `surface` / `surface-2` / `border` / `foreground` / `muted` / `accent` / `accent-foreground` / `success` / `danger` / `warning` / `highlight` / `code-bg`。
Tailwind では `bg-surface`、`text-muted`、`border-border`、`bg-accent/15` のように使う。

### 7.3 スペーシングスケール

Tailwind 既定(4px 基準)。ページ余白 `px-4`、カード内 `p-3` / `p-4`、縦のセクション間 `space-y-5`。`--spacing-tap: 44px`。

### 7.4 コンポーネント追加手順

1. `src/shared/ui/` に props だけで完結する部品を置く(`cn()` でクラス結合)
2. 色はトークン、タップ領域は `min-h-tap` 以上、`focus-visible` のアウトラインを付ける
3. E2E から触るものは `data-testid` を付ける

UI の文言・アイコン・書式の標準は `docs/ui-glossary.md`(`/hig-compliance` が保守)。新しいラベルは先に用語集へ追加する。

### 7.5 アイコン使用規約

依存を増やさないためインライン SVG のみ。タブは `NavIcon`(選択中は塗りつぶし、非選択は線画)。アイコンライブラリは入れない(入れる場合は先に ADR を書く)。

---

## 8. 過去の問題事例

| 問題                                                    | 原因                                                                             | 対策                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tsc` が `.next/dev/types/validator.ts` で失敗          | 削除したルートの生成型が残る                                                     | `rm -r .next/dev` 後に `pnpm typecheck`(`typecheck` は `next typegen` を先に実行)                                      |
| `ts-fsrs` の `review()` に渡す型が合わない              | `ReturnType<typeof DefaultScheduler>` が FSRS-7 以外のオーバーロードに解決される | `DefaultScheduler<"FSRS-7">` / `DefaultSchedulerCardInput<"FSRS-7">` を明示。`scheduleStatus` は relearning → learning |
| Vitest が `server-only` を含むモジュールを読んで落ちる  | 純粋関数と Next 依存が同じファイル                                               | 純粋関数を別ファイル(`safe-path.ts` 等)に分ける                                                                        |
| `pnpm format` が `CLAUDE.md` などを整形して差分が出た   | Prettier の対象にハーネス・人間管理ファイルが含まれていた                        | `.prettierignore` で除外                                                                                               |
| Playwright の `check()` がタイムアウト                  | ラジオが `sr-only` で不可視                                                      | ラベルをクリックする                                                                                                   |
| E2E が並列実行で互いの学習状態を見る                    | memory モードで同一ユーザーを共有                                                | テストごとに別 UUID の Cookie                                                                                          |
| `app/icon.tsx` が `fontSize: NaN` でビルド失敗          | `id` が Promise                                                                  | `await id`                                                                                                             |
| セッション完了画面が消える / `session-saved` が出ない   | `key={startedAt}` のため revalidate の再描画で SessionRunner が作り直された      | key はコース条件にし、進行中のセッションは開始時の props を state に保持する                                           |
| E2E が `next dev` の二重起動で動かない                  | 同じディレクトリで dev を 2 つ動かせない                                         | 手元の dev サーバーを止めてから `pnpm e2e` を実行する                                                                  |
| ビルド時の TypeScript 7(tsgo)/ ESLint 10 で設定が不安定 | 最新メジャーを自動解決した                                                       | TypeScript `^5`、ESLint `^9` に固定                                                                                    |

---

## 9. コンテンツ執筆(カードの作り方)

通しの手順は skill `/author-subject <URL>`(利用条件の確認 → 雛形 → クロール → スペック → 照合)。要点:

0. `pnpm content:init` で `content/<id>/` の雛形を作る(`license_note` は題材サイトの利用条件を確認して書く)
1. `pnpm pipeline:crawl --subject <id>`(`--exclude-path release-notes` など)でコーパスを作る。`pipeline/work/` は gitignore
2. `pipeline/specs/<id>.json` に語句・意味・選択肢を書く(`target` は実文に文字どおり含まれる語。語の一部にしない: `render` ではなく `rendering`)
3. `pnpm pipeline:author --subject <id> --spec pipeline/specs/<id>.json --out pipeline/work/authored/<id>/cards.jsonl` で起こし、出力の `target | sentence` を目視する
4. `match` / `url_hint` / `pick` で実文を狙い撃ちし、`content/<id>/` に確定 → `pnpm content:validate --write-manifest` → `pnpm pipeline:verify --subject <id>`
5. 人間が `pnpm content:review <id>` でレビュー → `--publish`

カード id は UUID v5(題材・層・語句・実文から決定論)なので、同じ実文なら再実行しても id が変わらない。
subagent に執筆を委任する場合は成果物をファイルに逐次書かせ、WebFetch の引用は `pipeline:verify` で必ず照合する。
