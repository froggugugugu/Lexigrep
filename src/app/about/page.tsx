import type { Metadata } from "next";
import Link from "next/link";
import { LAYERS, type Layer } from "@/shared/content/schema";
import { siteConfig } from "@/shared/site/config";
import { LinkButton } from "@/shared/ui/Button";
import { HighlightedSentence } from "@/shared/ui/HighlightedSentence";
import { LAYER_LABELS } from "@/shared/ui/labels";
import { REPOSITORY_URL, SiteCredit } from "@/shared/ui/SiteCredit";

export const metadata: Metadata = {
  title: "使い方",
  description: siteConfig.description,
};

const FEATURES = [
  {
    title: "実文から学ぶ",
    body: "カードはすべて、公式ドキュメントに実際に書かれている一文です。出典の URL から原文をすぐに確かめられます。",
  },
  {
    title: "1 日 3〜7 分",
    body: "1 回のセッションは 8〜20 枚。1 カード 1 画面で、答えるとその場で解説が出ます。",
  },
  {
    title: "忘れる前に、もう一度",
    body: "間隔反復(FSRS)が復習の時期を決めます。覚えたカードは間隔が伸び、まだのカードだけが戻ってきます。",
  },
];

const STEPS = [
  {
    title: "学習の目的を選ぶ",
    body: `ホームで「${siteConfig.baseCourse.goalTitle}」を広く学ぶか、題材を 1 つに絞るかを選びます。`,
  },
  {
    title: "セッションを始める",
    body: "復習の期限が来たカードを先に、残りはまだ学んでいない語句やよく出る語句から出題します。",
  },
  {
    title: "答えて、解説を読む",
    body: "実文を読んで設問に答えると、正誤と解説、出典が出ます。間違えたカードは同じセッションの中でもう一度出ます。",
  },
  {
    title: "記録と辞書で振り返る",
    body: "「記録」で連続日数と定着した語句を確かめ、「辞書」で語句を題材をまたいで引けます。",
  },
];

const LAYER_NOTES: Record<Layer, string> = {
  vocab: "ドキュメントに繰り返し出てくる基本の語",
  pattern: "文の型ごと覚えると速く読める言い回し",
  idiom: "直訳では意味が取れない決まり文句",
  system_term: "その題材の中で特別な意味を持つ語",
};

const sectionClass = "mt-14 border-t border-border pt-10";
const headingClass = "text-2xl font-semibold tracking-tight";
const inlineLinkClass =
  "font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AboutPage() {
  const { sample } = siteConfig;
  const start = sample.sentence.indexOf(sample.target);
  const highlight = { start, end: start + sample.target.length };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12">
      <nav className="flex min-h-14 items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-tap items-center text-base font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {siteConfig.name}
        </Link>
        <Link
          href="/"
          className={`inline-flex min-h-tap items-center text-sm ${inlineLinkClass}`}
        >
          始める
        </Link>
      </nav>

      <section data-testid="about-hero" className="pt-12 sm:pt-20">
        <h1 className="text-4xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl">
          読みたい英語を、
          <br />
          そのまま読む。
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
          {siteConfig.tagline}
        </p>
      </section>

      <section
        data-testid="about-sample"
        aria-label="カードの見本"
        className="mt-10 rounded-2xl border border-border bg-surface p-4 sm:p-6"
      >
        <p className="text-xs font-medium text-muted">カードの見本</p>
        <HighlightedSentence
          sentence={sample.sentence}
          highlight={highlight}
          className="mt-3"
        />
        <dl className="mt-4 flex items-baseline justify-between gap-4">
          <dt lang="en" className="text-base font-semibold">
            {sample.target}
          </dt>
          <dd className="text-right text-base">{sample.meaning}</dd>
        </dl>
        <p className="mt-3 text-xs text-muted">
          出典:{" "}
          <a
            href={sample.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {sample.sourceName}
          </a>
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>毎日、少しずつ。</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>使い方</h2>
        <ol data-testid="about-steps" className="mt-6 space-y-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-base leading-8 font-semibold">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>4 つの層で読む力をつける</h2>
        <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {LAYERS.map((layer) => (
            <div
              key={layer}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <dt className="text-sm font-semibold sm:w-36 sm:shrink-0">
                {LAYER_LABELS[layer]}
              </dt>
              <dd className="text-sm leading-6 text-muted">
                {LAYER_NOTES[layer]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>読みたいドキュメントを題材に</h2>
        <p className="mt-4 text-sm leading-7 text-muted">
          {siteConfig.name}{" "}
          はオープンソースです。リポジトリを手元に置けば、自分が読みたい英語のドキュメントを題材として足せます。サイトの実文からカードの下書きを作り、内容を自分で確かめてから学習に使います。
        </p>
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-2 inline-flex min-h-tap items-center gap-1 text-sm ${inlineLinkClass}`}
        >
          GitHub で手順を見る
          <span aria-hidden="true">›</span>
        </a>
      </section>

      <div className="mt-14">
        <LinkButton href="/" size="lg" full data-testid="about-start">
          始める
        </LinkButton>
      </div>

      <footer className="mt-12 border-t border-border pt-6">
        <SiteCredit />
        <p className="mt-1 text-[11px] leading-5 text-muted">
          カードの実文は各ドキュメントからの引用で、権利はそれぞれの権利者にあります。
          {siteConfig.name}{" "}
          は引用元の企業・プロジェクトとは関係のない、個人が作っているアプリです。
        </p>
      </footer>
    </main>
  );
}
