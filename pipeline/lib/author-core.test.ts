import { describe, expect, it } from "vitest";
import {
  authorCard,
  findCandidates,
  linkRelated,
  uuidV5,
  type AuthorSpec,
} from "./author-core";
import type { PageText } from "./text";

const pages: PageText[] = [
  {
    url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
    title: "Everyday Types",
    sentences: [
      "Type ‘string’ is not assignable to type ‘number’.",
      "A much longer sentence that also says the type is not assignable to the other type, which we should not prefer because it goes far beyond the length that reads well on a phone screen.",
    ],
    fetched_at: "2026-11-01T00:00:00.000Z",
  },
  {
    url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html",
    title: "Narrowing",
    sentences: ["TypeScript uses narrowing to refine types."],
    fetched_at: "2026-11-01T00:00:00.000Z",
  },
];

const spec: AuthorSpec = {
  layer: "pattern",
  target: "is not assignable to",
  pick: 0,
  meaning_ja: "〜に代入できない",
  note_ja: null,
  question_type: "choose_meaning",
  prompt_ja: null,
  options: ["a", "b", "c", "d"],
  answer: 0,
  rank: 1,
  related: ["narrowing"],
};

describe("uuidV5", () => {
  it("同じ名前からは同じ UUID、形式は v5", () => {
    const a = uuidV5("lexigrep:x");
    expect(a).toBe(uuidV5("lexigrep:x"));
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(uuidV5("lexigrep:y")).not.toBe(a);
  });
});

describe("findCandidates / authorCard", () => {
  it("散文らしい文を優先し、出典とハイライトを機械的に付ける", () => {
    const c = findCandidates(spec, pages);
    expect(c[0]?.sentence).toBe(
      "Type ‘string’ is not assignable to type ‘number’.",
    );
    const r = authorCard(
      spec,
      "typescript",
      "human",
      pages,
      new Date("2026-11-02T00:00:00.000Z"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.highlight).toEqual({ start: 14, end: 34 });
      expect(r.card.sources[0]?.title).toBe("Everyday Types");
      expect(r.card.status).toBe("draft");
    }
  });

  it("url_hint でページを優先できる", () => {
    const c = findCandidates(
      { ...spec, target: "type", match: "type", url_hint: "narrowing" },
      pages,
    );
    expect(c[0]?.page.title).toBe("Narrowing");
  });

  it("実文が無ければ失敗を返す", () => {
    const r = authorCard(
      { ...spec, target: "does not exist" },
      "typescript",
      "human",
      pages,
      new Date(),
    );
    expect(r.ok).toBe(false);
  });
});

describe("linkRelated", () => {
  it("target 文字列で指定した関連を id に解決し、自分自身は除く", () => {
    const narrowing: AuthorSpec = {
      ...spec,
      layer: "system_term",
      target: "narrowing",
      related: ["is not assignable to", "narrowing"],
    };
    const cards = [spec, narrowing]
      .map((s) => authorCard(s, "typescript", "human", pages, new Date()))
      .flatMap((r) => (r.ok ? [r.card] : []));
    const linked = linkRelated(cards, [spec, narrowing]);
    expect(linked[0]?.related_card_ids).toEqual([linked[1]?.id]);
    expect(linked[1]?.related_card_ids).toEqual([linked[0]?.id]);
  });
});
