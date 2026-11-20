# コンテンツの出典と権利について

このディレクトリのカード(`<subject>/cards.jsonl`)は、英語の公式ドキュメントから**文単位の短い引用**(`sentence`)を取り、
日本語の意味・解説・設問を付けたものである。リポジトリの [MIT License](../LICENSE) が対象とするのは、コードと、
カードのうち Lexigrep が書いた部分(日本語の意味・解説・設問・選択肢)である。**引用した英語の実文の権利は、それぞれの権利者にある。**

- 引用は 1 カードにつき 1 文(最大 400 文字)で、学習(語句の意味と使われ方の解説)に必要な範囲にとどめている
- すべてのカードは出典の URL とページタイトルを持ち(`sources`)、アプリのカード詳細と解説の画面に表示する
- 実文は原文のまま載せ、改変しない(`pnpm pipeline:verify` がクロール結果と文字どおり一致することを照合する)

## 題材ごとの出典

| 題材          | 出典                                            | 権利者とライセンス                                                                                                                                                                 |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript`  | <https://www.typescriptlang.org/docs/handbook/> | © Microsoft Corporation。ドキュメントは [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)([microsoft/TypeScript-Website](https://github.com/microsoft/TypeScript-Website)) |
| `nextjs`      | <https://nextjs.org/docs/app>                   | © Vercel, Inc.。[MIT License](https://github.com/vercel/next.js/blob/canary/license.md)([vercel/next.js](https://github.com/vercel/next.js) の `docs/`)                            |
| `claude-code` | <https://code.claude.com/docs/en/>              | © Anthropic, PBC。オープンなライセンスでは提供されていない。解説のための短い引用として、出典を示して掲載している                                                                   |

TypeScript の題材は CC BY 4.0 の条件に従い、出典(各カードの URL)とライセンスを示している。引用した文は改変していない。

## 権利者の方へ

掲載に問題がある場合は、[Issue](https://github.com/froggugugugu/Lexigrep/issues) で知らせてほしい。該当するカードを速やかに取り下げる。

## 題材を追加する人へ

`/author-subject` や `pnpm content:init` で題材を足すときは、先に題材サイトの利用条件と robots.txt を確認し、
引用の方針を `subject.json` の `license_note` に書く。再配布する(公開リポジトリに push する)場合は、この表に 1 行足す。
