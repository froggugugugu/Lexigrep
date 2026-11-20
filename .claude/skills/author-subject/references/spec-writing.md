# 執筆スペックの書き方

`pipeline/specs/<id>.json` の形式は `pipeline/lib/author-core.ts` の `authorFileSchema` が正。

```json
{
  "subject_id": "<id>",
  "generated_by": "<モデル ID または human>",
  "specs": [
    {
      "layer": "pattern",
      "target": "is not assignable to",
      "meaning_ja": "〜に代入できない(型の互換性がない)",
      "note_ja": "型エラーの定型文。前が実際の型、後ろが期待される型。",
      "question_type": "choose_meaning",
      "options": ["正解", "誤答 1", "誤答 2", "誤答 3"],
      "answer": 0,
      "rank": 1,
      "related": ["assignable"]
    }
  ]
}
```

任意項目 `match` / `url_hint` / `pick` / `prompt_ja` は必要なときだけ足す(`match` と `url_hint` に null は書けない)。

## 層の選び方

| 層 | 対象 | 例 |
| -- | ---- | -- |
| `vocab` | 分野を問わず技術文書で頻出する単語 | deprecated, assignable, fallback |
| `pattern` | 意味のまとまりで覚える定型の言い回し | is not assignable to, in favor of |
| `idiom` | 慣用句・定型句(文字どおりの意味から外れるもの) | under the hood, out of the box |
| `system_term` | この題材でしか使わない用語・機能名 | (Next.js の)Server Actions、(S3 の)bucket policy |

`vocab` / `pattern` / `idiom` は題材をまたいだベースコースにも出る(同じ語句は 1 枚にまとめて出題される)。題材固有の意味でしか使わない語は `system_term` にする。

## 項目の決め方

- `target`: 実文に**文字どおり**含まれる形で書く。語の一部にしない(`render` ではなく `rendering`)。活用形が違えば別の形を target にする
- `match`: target が短く候補が多すぎるとき、実文を絞る部分文字列(例: target `fallback` + match `fallback page`)
- `url_hint`: 出典にしたいページの URL の一部。同じ語が多数のページにあるとき、説明の中心のページを選ぶ
- `pick`: 候補の何番目を使うか。`pipeline:author` の出力を見て、文脈のある文に変える
- `meaning_ja`: この文脈での意味を 1 行で。辞書の訳語を並べない
- `note_ja`: 訳語 + 1 文の補足。使われ方・似た語との違い・エラー文での形など
- `rank`: 頻度順(1 が最頻出)。`frequency.json` の順位を基準にし、学ぶ順に意味があれば調整する
- `related`: 同じファイル内の他スペックの `target` を指す

## 設問と選択肢

| `question_type` | 使う場面 |
| --------------- | -------- |
| `choose_meaning` | 既定。target の意味を選ぶ |
| `fill_blank` | 定型句で、前後の語から入る語を当てさせたいとき(options は英語) |
| `recognize_pattern` | 同じパターンを含む文を選ばせるとき(options は英文) |
| `next_action` | 手順・エラー文を読んで次の行動を選ばせるとき |

- options は 4 つ(2〜6)。重複させない。表示時にシャッフルされるので `answer` は 0 でよい
- 誤答は「同じ分野で紛らわしいが、この文脈では違う」意味にする。明らかに無関係な誤答は学習にならない
- 正解の選択肢だけ長く詳しくしない(長さで正解が分かってしまう)

## よくある失敗

| 失敗 | 対処 |
| ---- | ---- |
| 実文が見出し・ナビゲーションの断片 | `match` で本文の文を指定するか `pick` を変える |
| 実文が長すぎて target が埋もれる | 短い文が選ばれるよう `match` を target の前後に広げる |
| 候補が 0 件で author が失敗する | target がコーパスに文字どおり無い。表記(単数 / 複数、ハイフン)を `frequency.json` の例文に合わせる |
| 同じ語を `vocab` と `system_term` の両方に作る | どちらか 1 つにする(上の層の基準) |
