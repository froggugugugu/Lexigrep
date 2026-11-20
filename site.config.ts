/**
 * サイトの文言設定。題材(コンテンツ)に依存する言い回しはここに置き、アプリのコードには書かない。
 * clone して別の分野の英語を学ぶ場合は、このファイルの値を書き換える。
 * 値は `src/shared/site/config.ts` が起動時に検証する。
 */
const siteConfig = {
  /** アプリ名(タイトル・PWA) */
  name: "Lexigrep",
  /** メタデータと PWA の説明文 */
  description:
    "公式ドキュメント・エラーメッセージ・SaaS UI を翻訳なしで読めるようになる、エンジニア向けの英語パターン学習アプリ",
  /** ログイン画面の紹介文 */
  tagline:
    "公式ドキュメント・エラーメッセージ・SaaS の UI を、翻訳なしでそのまま読めるようになる。実文に紐づく頻出パターンを 1 日 3〜7 分で反復します。",
  /** 題材横断のベースコース */
  baseCourse: {
    /** ホームの学習目的ボタン */
    goalTitle: "IT 英語全般",
    /** セッション画面の見出し(短い名前) */
    shortName: "IT 英語ベース",
    /** ホームのステップ 1 の見出し */
    stepTitle: "IT 英語の土台",
  },
  /** 紹介ページ(/about)に出すカードの見本。sentence の中に target が文字どおり含まれること */
  sample: {
    sentence:
      "Turbopack supports importing node_modules Sass files out of the box.",
    target: "out of the box",
    meaning: "追加設定なしで",
    sourceName: "Next.js Docs",
    sourceUrl: "https://nextjs.org/docs/app/api-reference/turbopack",
  },
};

export default siteConfig;
