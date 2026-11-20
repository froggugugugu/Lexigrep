/**
 * HTML → テキスト化・文分割・トークン化・n-gram 集計(純粋関数)。
 */
import * as cheerio from "cheerio";

export type PageText = {
  url: string;
  title: string;
  /** 本文の文の配列(コードブロックは除く) */
  sentences: string[];
  fetched_at: string;
};

/** 本文から除く要素。コードブロック(pre)は除くが、文中のインラインコード(code)は語彙として残す */
const DROP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "pre",
  "svg",
  "iframe",
  "[aria-hidden='true']",
  ".sidebar",
  ".toc",
  ".breadcrumbs",
];

const BLOCK_SELECTOR = "p, li, td, th, dd, dt, blockquote";

/** HTML から本文テキストを取り出す(段落・リスト・表のセル・引用。見出しは文ではないので除く) */
export function extractText(
  html: string,
  url: string,
  fetchedAt: string,
): PageText {
  const $ = cheerio.load(html);
  const title = ($("title").first().text() || $("h1").first().text() || url)
    .trim()
    .replace(/\s+/g, " ");
  $(DROP_SELECTORS.join(",")).remove();
  const root =
    $("main").length > 0
      ? $("main")
      : $("article").length > 0
        ? $("article")
        : $("body");
  const blocks: string[] = [];
  root.find(BLOCK_SELECTOR).each((_, el) => {
    // 入れ子のブロック(li の中の p など)を二重に拾わない
    if ($(el).find(BLOCK_SELECTOR).length > 0) return;
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length >= 20) blocks.push(t);
  });
  const sentences = Array.from(new Set(blocks.flatMap(splitSentences)));
  return { url, title, sentences, fetched_at: fetchedAt };
}

/**
 * 学習カードの実文として適した「散文らしい文」か。
 * 見出し・目次項目・ラベル(短く、終端記号が無い)を除くための緩い判定。
 */
export function isProse(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/).length;
  if (words < 6) return false;
  return /[.!?:;]$/.test(sentence.trim()) || sentence.includes(", ");
}

/** 文分割(略語 e.g. / i.e. / etc. と小数・バージョン番号を保護する簡易版) */
export function splitSentences(text: string): string[] {
  const protectedText = text
    .replace(/\b(e\.g|i\.e|etc|vs|cf|Mr|Dr|No)\.\s/g, (m) =>
      m.replace(". ", "\u0001 "),
    )
    .replace(/(\d)\.(\d)/g, "$1\u0002$2");
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z"'`(\[])/)
    .map((s) =>
      s
        .replace(/\u0001/g, ".")
        .replace(/\u0002/g, ".")
        .trim(),
    )
    .filter((s) => s.length >= 20 && s.length <= 400 && /[a-z]/.test(s));
}

export const STOPWORDS = new Set(
  `a an the and or but if then else of to in on at by for with from as is are was were be been being
   this that these those it its it's they them their there here we you your our i he she his her
   do does did done have has had having can could may might must shall should will would
   so than too very just also about above after again against all any because before below between both
   each few further how into more most off once only other out over own same some such through under until
   up down while who whom whose why what when where which one two three s t re ve ll d m`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * 学習価値の低い一般語(単語単体の候補からは除く。n-gram の一部としては残す)。
 * 「読めるようになる」目的では deprecated / resolve のような語を優先したい。
 */
export const GENERIC_WORDS = new Set(
  `not like now new see use using used following example examples also way want need make makes get set let
   one first second two more well here there thing things something anything case cases means mean
   call called calls take takes give given go goes know let's note notes page pages section`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * 多くのページに同じ文が現れるものは定型の boilerplate(フッター・ナビ・編集リンク等)とみなして除く。
 * @param pages ページごとの文の配列
 * @param maxShare 文が現れるページの割合がこれを超えたら除外(既定 0.2 = 20%)
 */
export function dropBoilerplate(
  pages: readonly (readonly string[])[],
  maxShare = 0.2,
): string[][] {
  if (pages.length < 3) return pages.map((p) => [...p]);
  const pageCount = new Map<string, number>();
  for (const page of pages) {
    for (const s of new Set(page))
      pageCount.set(s, (pageCount.get(s) ?? 0) + 1);
  }
  const limit = Math.max(2, Math.floor(pages.length * maxShare));
  return pages.map((page) =>
    page.filter((s) => (pageCount.get(s) ?? 0) <= limit),
  );
}

export function tokenize(sentence: string): string[] {
  return (
    sentence.toLowerCase().match(/[a-z][a-z0-9'’-]*[a-z0-9]|[a-z]/g) ?? []
  ).map((t) => t.replace(/’/g, "'"));
}

export type NgramStat = {
  term: string;
  n: number;
  count: number;
  /** 出現した文の数(document frequency 相当) */
  df: number;
  examples: string[];
};

export type FrequencyOptions = {
  maxN?: number;
  top?: number;
  minCount?: number;
  examplesPerTerm?: number;
  /** 題材名など、候補から除きたい語(小文字) */
  exclude?: ReadonlySet<string>;
};

/** 語・2〜4gram の出現頻度を集計する。両端がストップワードの n-gram と数字だけの語は除く */
export function countNgrams(
  sentences: readonly string[],
  options: FrequencyOptions = {},
): NgramStat[] {
  const maxN = options.maxN ?? 4;
  const top = options.top ?? 300;
  const minCount = options.minCount ?? 2;
  const examplesPerTerm = options.examplesPerTerm ?? 3;
  const exclude = options.exclude ?? new Set<string>();
  const stats = new Map<string, NgramStat>();

  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    const seen = new Set<string>();
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n);
        if (!isUsefulGram(gram, exclude)) continue;
        const term = gram.join(" ");
        let s = stats.get(term);
        if (!s) {
          s = { term, n, count: 0, df: 0, examples: [] };
          stats.set(term, s);
        }
        s.count += 1;
        if (!seen.has(term)) {
          seen.add(term);
          s.df += 1;
          if (s.examples.length < examplesPerTerm) s.examples.push(sentence);
        }
      }
    }
  }

  return [...stats.values()]
    .filter((s) => s.count >= minCount)
    .sort(
      (a, b) =>
        b.df - a.df || b.count - a.count || a.term.localeCompare(b.term),
    )
    .slice(0, top);
}

function isUsefulGram(gram: string[], exclude: ReadonlySet<string>): boolean {
  const first = gram[0]!;
  const last = gram[gram.length - 1]!;
  if (gram.some((g) => exclude.has(g))) return false;
  if (gram.length === 1) {
    return (
      !STOPWORDS.has(first) &&
      !GENERIC_WORDS.has(first) &&
      first.length >= 3 &&
      !/^\d+$/.test(first)
    );
  }
  if (STOPWORDS.has(first) || STOPWORDS.has(last)) return false;
  // すべてストップワードでない語が 1 つ以上
  return gram.some((g) => !STOPWORDS.has(g) && g.length >= 3);
}

/** 空白・引用符のゆれを吸収した上で、文がコーパスに含まれるか */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function corpusContains(
  corpus: readonly string[],
  sentence: string,
): boolean {
  const needle = normalizeForMatch(sentence);
  if (needle === "") return false;
  return corpus.some((s) => normalizeForMatch(s).includes(needle));
}
