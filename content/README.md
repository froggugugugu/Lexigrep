# content

学習コンテンツ(Pattern)とその検証。

## 構成

- `patterns/docs.json` / `saas-ui.json` / `dev-comm.json`: Pattern の配列(1ファイル=1カテゴリ)。1ファイル1オブジェクトでも検証は通る。
- 検証: `node content/validate.mjs`(依存なし、Node 18+)。CI は `.github/workflows/content-validate.yml`。

## データ契約

```ts
Pattern = {
  id: string,            // kebab-case、全体で一意
  category: "docs" | "saas-ui" | "dev-comm",
  source: string,        // 例 "GitHub PR", "AWS Console", "MDN"
  pattern: string,       // 型。例 "X is deprecated and will be removed in Y"
  meaning_ja: string,
  example_en: string,
  example_ja: string,
  note_ja?: string,      // 実務での使いどころ・誤読しやすい点
  drills: Drill[],       // 2つ以上(現状は各3つ)
  level: 1 | 2 | 3,
}

Drill =
  | { type: "choice", prompt_en: string, choices_ja: string[], answer: number, explanation_ja: string }
  | { type: "cloze",  sentence_en: string /* 空所は ____ を1つ */, choices_en: string[], answer: number, explanation_ja: string }
```

- `answer` は `choices_ja` / `choices_en` のインデックス。選択肢は3〜4個で、重複なし。
- `explanation_ja` は誤答時に表示する解説(1〜2文)。仕様上は任意項目だが、このリポジトリのコンテンツでは全 drill に必須(validate が検査する)。位置に依存しない書き方にしてあるので、アプリ側で選択肢を並べ替えても矛盾しない。
- 選択肢は正解位置をシャッフル済み。validate は正解位置が偏りすぎていないかも検査する。

## 注意: 公式文面の逐語ではありません

- `example_en` / `prompt_en` / `sentence_en` は、各ドキュメント・UI・コミュニケーションで実際に使われる典型表現に基づく再構成であり、公式文面の逐語引用ではありません。
- `source` は「その表現がよく現れる場所」を示すもので、そのサイトの現行文面そのものであることを保証しません。製品の UI やドキュメントは頻繁に変わります。
- 逐語の引用が必要になる機能(貼り付け解析など)では、この content を原文の根拠として使わないこと。

## 追加時の指針

- 実在する典型表現のみ。意味(`meaning_ja`)は正確に、`note_ja` には実務での使いどころや誤読しやすい点を書く。
- cloze の誤答は「活用違い」だけにせず、意味の違う紛らわしい語・前置詞・定型句を使う。ただし、空所に入れて成立する選択肢が複数ないこと。
- 解説は「なぜ正解か」と「主な誤答がなぜ違うか」を書く。

## 人間レビュー用チェックリスト

公開前に、英語と日本語に詳しい人が次の点を確認する。

- [ ] 各 `pattern` が実在する典型表現か。不自然・古い・誤用の表現がないか。
- [ ] `meaning_ja` / `example_ja` / `explanation_ja` のニュアンス(特に deprecated, undefined / unspecified, blocking / non-blocking, punt, bikeshedding, stale, no-op, mutually exclusive)。
- [ ] cloze の正解が1つに定まるか。誤答が文法的・意味的に成立していないか。
- [ ] 製品固有の記述が現行の仕様と合っているか:
  - AWS: `is not authorized to perform: <action> on resource: <arn>`、`IncorrectInstanceState`(stopped のインスタンスのみ start できる)、クォータ超過の文言
  - GitHub: `Closes/Fixes/Resolves #N` による自動クローズ、API rate limit の文言、トークンの「二度と表示されない」注意、リポジトリ削除時の確認入力、Draft PR / Request changes
  - Stripe: `Invalid API Key provided: sk_test_****…`、`No such customer`、decline code `insufficient_funds`、`Roll key`
  - Dependabot の PR タイトル `Bump X from A to B`、actions/stale の文言、`git revert` が生成するメッセージ
  - Node.js `fs.exists()` / `Buffer()` の非推奨、Python の `Added in version` / `Deprecated since version`、C++ の undefined behavior
- [ ] `source` の記載が過大でないか(例: 「Kubernetes docs」「Docker docs」は、その種のドキュメントによく見られる表現という意味)。
- [ ] 難易度 `level`(1: 基本語彙、2: 実務で頻出、3: 含意・慣用句の理解が要る)が妥当か。
