# ADR-006: 題材カテゴリを列挙から slug 文字列にする

- ステータス: Accepted(オーナーが推奨案を承認)
- 日付: 2026-11-03
- 関連: `src/shared/content/schema.ts`、`src/shared/ui/labels.ts`、`supabase/migrations/0003_subject_category_text.sql`

## 背景

clone した人が好きな英語サイトを題材にできるようにする(方向性 A)。カテゴリは IT 向けの 5 値(`genai` / `language_fw` / `cloud` / `idp` / `testing`)の列挙で、Zod と DB の enum の両方に固定されていた。題材を足すたびにコードとマイグレーションの変更が要り、「アプリは特定題材を知らない」原則と合わない。

## 決定

- `category` は slug 形式(`^[a-z0-9]+([_-][a-z0-9]+)*$`、40 字以内)の自由な文字列にする。Zod と DB CHECK の両方で強制する
- 表示名は任意項目 `category_label` で題材が与える。未指定なら既知 5 値の表示名、それも無ければ値そのものを出す(`categoryLabel()`)
- DB は `0003` で `category` を text に変換し(既存行は `using category::text` で保持)、enum 型を削除する

## 代替案

| 案                     | 長所         | 短所(不採用の理由)                   |
| ---------------------- | ------------ | ------------------------------------ |
| enum に `other` を足す | 変更が小さい | 新しい分野の表示が「その他」に潰れる |
| カテゴリを廃止する     | 最も単純     | 題材ブラウザのバッジが消える         |

## 影響

- 新しいカテゴリの題材を Supabase に投入する前に `0003` の適用が要る
- 表示名を `subject.json` から消したとき DB に古い値が残らないよう、投入スクリプトは `category_label` を null で明示して upsert する
