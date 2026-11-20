import { describe, expect, it } from "vitest";
import type { Subject } from "../../src/shared/content/schema";
import {
  assembleCard,
  buildUserPrompt,
  findTargetIndex,
  generatedBatchSchema,
  mergeCards,
  rankForGenerated,
  selectTargets,
  verifyGenerated,
  type GeneratedCard,
} from "./generate-core";
import type { PageText } from "./text";
import type { TermEntry } from "./work";

const page: PageText = {
  url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
  title: "Everyday Types",
  sentences: [
    "Type ‘string’ is not assignable to type ‘number’.",
    "Type annotations always go after the thing being typed.",
  ],
  fetched_at: "2026-11-01T00:00:00.000Z",
};

const subject: Subject = {
  id: "typescript",
  name: "TypeScript",
  category: "language_fw",
  description_ja: "x",
  official_urls: [page.url],
  license_note: "",
  version: 1,
  crawled_at: null,
  is_published: true,
};

const generated: GeneratedCard = {
  layer: "pattern",
  target: "is not assignable to",
  sentence: "Type 'string' is not assignable to type 'number'.",
  source_url: page.url,
  meaning_ja: "〜に代入できない",
  note_ja: "型エラーの定型文。",
  question_type: "choose_meaning",
  prompt_ja: null,
  options: [
    "〜に代入できない",
    "〜に割り当て済み",
    "〜と互換がある",
    "〜を推論できない",
  ],
  answer: 0,
  frequency_rank: 1,
};

describe("generatedBatchSchema", () => {
  it("ツール応答を検証する", () => {
    expect(generatedBatchSchema.safeParse({ cards: [generated] }).success).toBe(
      true,
    );
    expect(
      generatedBatchSchema.safeParse({
        cards: [{ ...generated, layer: "other" }],
      }).success,
    ).toBe(false);
  });
});

describe("verifyGenerated", () => {
  it("コーパスに存在する実文(クォートのゆれ許容)を原文で採用し、target を語境界で探す", () => {
    const r = verifyGenerated(generated, [page]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sentence).toBe(page.sentences[0]);
      expect(r.highlight).toEqual({ start: 14, end: 34 });
    }
    const partial = verifyGenerated({ ...generated, target: "sign" }, [page]);
    expect(partial.ok).toBe(false);
  });

  it("コーパスに無い文・target 不包含・選択肢の重複を拒否する", () => {
    expect(
      verifyGenerated(
        { ...generated, sentence: "Type 'x' is not assignable to type 'y'." },
        [page],
      ).ok,
    ).toBe(false);
    expect(
      verifyGenerated({ ...generated, target: "assignable from" }, [page]).ok,
    ).toBe(false);
    expect(
      verifyGenerated({ ...generated, options: ["a", "a", "b", "c"] }, [page])
        .ok,
    ).toBe(false);
  });
});

describe("assembleCard / mergeCards / selectTargets", () => {
  it("検証済みの生成結果から draft カードを組み立て、重複は統合時に除く", () => {
    const r = verifyGenerated(generated, [page]);
    if (!r.ok) throw new Error("expected ok");
    const card = assembleCard(
      generated,
      subject.id,
      r,
      "claude-test",
      new Date("2026-11-02T00:00:00.000Z"),
    );
    expect(card.status).toBe("draft");
    expect(card.sources[0]?.url).toBe(page.url);
    expect(card.highlight).toEqual({ start: 14, end: 34 });

    const again = assembleCard(
      generated,
      subject.id,
      r,
      "claude-test",
      new Date(),
    );
    const merged = mergeCards([card], [again]);
    expect(merged.added).toBe(0);
    expect(merged.skipped).toBe(1);

    const terms: TermEntry[] = [
      {
        term: "is not assignable to",
        n: 4,
        count: 5,
        df: 5,
        examples: [{ sentence: page.sentences[0]!, url: page.url }],
      },
      {
        term: "annotations",
        n: 1,
        count: 3,
        df: 3,
        examples: [{ sentence: page.sentences[1]!, url: page.url }],
      },
      { term: "no examples", n: 2, count: 2, df: 2, examples: [] },
    ];
    expect(selectTargets(terms, [card], 10).map((t) => t.term)).toEqual([
      "annotations",
    ]);
  });
});

describe("buildUserPrompt", () => {
  it("語句ごとに順位と実文・URL を列挙する", () => {
    const text = buildUserPrompt(
      [
        {
          term: "annotations",
          n: 1,
          count: 3,
          df: 3,
          examples: [{ sentence: page.sentences[1]!, url: page.url }],
        },
      ],
      10,
    );
    expect(text).toContain('"annotations"');
    expect(text).toContain("frequency_rank: 11");
    expect(text).toContain(page.url);
  });
});

describe("findTargetIndex / rankForGenerated", () => {
  it("語境界で一致させ、順位は対象語句の位置からコードで決める", () => {
    expect(findTargetIndex("Use it because it works.", "use")).toBe(-1);
    expect(findTargetIndex("Use it because it works.", "Use")).toBe(0);
    expect(findTargetIndex("You can use it.", "use")).toBe(8);
    const batch: TermEntry[] = [
      { term: "annotations", n: 1, count: 1, df: 1, examples: [] },
      { term: "is not assignable to", n: 4, count: 1, df: 1, examples: [] },
    ];
    expect(rankForGenerated(generated, batch, 10)).toBe(12);
    expect(
      rankForGenerated({ ...generated, target: "zzz" }, batch, 10),
    ).toBeNull();
  });
});
