import { describe, expect, it } from "vitest";
import {
  isProse,
  corpusContains,
  countNgrams,
  dropBoilerplate,
  extractText,
  splitSentences,
  tokenize,
} from "./text";

describe("extractText", () => {
  it("nav / code / script を除き、本文の文だけを取り出す", () => {
    const html = `<html><head><title>Everyday Types</title></head><body>
      <nav><a>Skip this navigation text entirely please</a></nav>
      <main>
        <h1>Everyday Types</h1>
        <p>Type annotations always go after the thing being typed. This is a second sentence of text.</p>
        <p>Enable <code>strictNullChecks</code> to make the compiler check for null values.</p>
        <pre><code>const x: number = 1; // this code must not appear in output</code></pre>
        <script>var secret = "no scripts in output at all";</script>
      </main></body></html>`;
    const page = extractText(
      html,
      "https://example.com/",
      "2026-11-01T00:00:00.000Z",
    );
    expect(page.title).toBe("Everyday Types");
    expect(page.sentences).toContain(
      "Type annotations always go after the thing being typed.",
    );
    expect(page.sentences.join(" ")).not.toContain("code must not");
    expect(page.sentences.join(" ")).not.toContain("scripts");
    expect(page.sentences.join(" ")).not.toContain("navigation");
  });
});

describe("splitSentences", () => {
  it("略語とバージョン番号で分割しない", () => {
    const s = splitSentences(
      "Use a bundler, e.g. Vite or esbuild, with TypeScript 5.4 or later. Then run the build again.",
    );
    expect(s).toEqual([
      "Use a bundler, e.g. Vite or esbuild, with TypeScript 5.4 or later.",
      "Then run the build again.",
    ]);
  });

  it("短すぎる・長すぎる断片を捨てる", () => {
    expect(splitSentences("Short one. " + "A".repeat(500) + ".")).toEqual([]);
  });
});

describe("tokenize / countNgrams", () => {
  it("小文字化し、アポストロフィとハイフンを語の一部として扱う", () => {
    expect(tokenize("Don't use type-only imports here.")).toEqual([
      "don't",
      "use",
      "type-only",
      "imports",
      "here",
    ]);
  });

  it("ストップワードで始まる/終わる n-gram を除き、df 順に並べる", () => {
    const sentences = [
      "The value is not assignable to the parameter.",
      "This type is not assignable to that type.",
      "Something is not assignable here.",
    ];
    const stats = countNgrams(sentences, { maxN: 3, minCount: 2, top: 50 });
    const terms = stats.map((s) => s.term);
    expect(terms).toContain("not assignable");
    expect(terms).toContain("assignable");
    expect(terms).not.toContain("is not");
    expect(terms).not.toContain("to the");
    const na = stats.find((s) => s.term === "not assignable")!;
    expect(na.df).toBe(3);
    expect(na.examples).toHaveLength(3);
  });
});

describe("corpusContains", () => {
  it("空白とクォートのゆれを吸収して部分一致する", () => {
    const corpus = [
      "Type ‘string’ is not assignable to type ‘number’.  Really.",
    ];
    expect(
      corpusContains(
        corpus,
        "Type 'string' is not assignable to type 'number'.",
      ),
    ).toBe(true);
    expect(
      corpusContains(
        corpus,
        "Type 'boolean' is not assignable to type 'number'.",
      ),
    ).toBe(false);
  });
});

describe("dropBoilerplate / exclude", () => {
  it("多くのページに現れる定型文を除く", () => {
    const common = "Help us improve these pages by sending a Pull Request.";
    const pages = [
      [common, "Page one talks about narrowing in detail."],
      [common, "Page two talks about generics in detail."],
      [common, "Page three talks about modules in detail."],
      [common, "Page four talks about classes in detail."],
      [common, "Page five talks about enums in detail."],
    ];
    const cleaned = dropBoilerplate(pages, 0.2);
    expect(cleaned.flat()).not.toContain(common);
    expect(cleaned.flat()).toHaveLength(5);
  });

  it("exclude と一般語は単語候補から外れる", () => {
    const sentences = [
      "TypeScript makes types like this.",
      "TypeScript makes types like that.",
      "TypeScript makes types like those.",
    ];
    const terms = countNgrams(sentences, {
      maxN: 1,
      minCount: 2,
      exclude: new Set(["typescript"]),
    }).map((s) => s.term);
    expect(terms).not.toContain("typescript");
    expect(terms).not.toContain("like");
    expect(terms).toContain("types");
  });
});

describe("isProse", () => {
  it("見出しやラベルを除き、散文らしい文だけを通す", () => {
    expect(isProse("Truthiness narrowing")).toBe(false);
    expect(isProse("Server Components and SEO")).toBe(false);
    expect(
      isProse("Type annotations always go after the thing being typed."),
    ).toBe(true);
    expect(
      isProse("Here, the value is a tuple type of string and number"),
    ).toBe(true);
  });
});
