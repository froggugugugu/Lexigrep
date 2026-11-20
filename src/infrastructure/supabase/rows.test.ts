import { describe, expect, it } from "vitest";
import type { Card } from "@/shared/content/schema";
import {
  cardToRows,
  formatInt4Range,
  parseInt4Range,
  rowToCard,
  rowToReviewState,
  rowToSubject,
} from "./rows";

const card: Card = {
  id: "11111111-1111-4111-8111-111111111111",
  subject_id: "typescript",
  layer: "pattern",
  target: "is not assignable to",
  sentence: "Type 'string' is not assignable to type 'number'.",
  highlight: { start: 14, end: 34 },
  meaning_ja: "〜に代入できない",
  note_ja: null,
  question_type: "choose_meaning",
  prompt_ja: null,
  choices: { options: ["a", "b", "c", "d"], answer: 0 },
  frequency_rank: 1,
  related_card_ids: [],
  generated_by: "human",
  reviewed_by: "owner",
  status: "published",
  sources: [
    {
      url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
      title: "Everyday Types",
      fetched_at: "2026-11-01T00:00:00.000Z",
      attribution: null,
    },
  ],
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
};

describe("parseInt4Range / formatInt4Range", () => {
  it("正規形 [a,b) を解釈する", () => {
    expect(parseInt4Range("[14,34)")).toEqual({ start: 14, end: 34 });
  });

  it("閉区間・開区間の境界を半開区間に正規化する", () => {
    expect(parseInt4Range("[14,33]")).toEqual({ start: 14, end: 34 });
    expect(parseInt4Range("(13,34)")).toEqual({ start: 14, end: 34 });
  });

  it("不正な文字列は例外", () => {
    expect(() => parseInt4Range("14-34")).toThrow();
  });

  it("formatInt4Range は半開区間で出力する", () => {
    expect(formatInt4Range({ start: 14, end: 34 })).toBe("[14,34)");
  });
});

describe("rowToCard / cardToRows", () => {
  it("DB 行(int4range + card_sources)からカードを復元できる(往復)", () => {
    const { card: row, sources } = cardToRows(card);
    expect(row.highlight).toBe("[14,34)");
    const restored = rowToCard({
      ...row,
      created_at: "2026-11-01T00:00:00+00:00",
      updated_at: "2026-11-01T00:00:00+00:00",
      card_sources: sources.map((s) => ({
        ...s,
        id: "22222222-2222-4222-8222-222222222222",
        fetched_at: "2026-11-01T00:00:00+00:00",
      })),
    });
    expect(restored).toEqual(card);
  });

  it("related_card_ids が null の行は空配列にする", () => {
    const { card: row, sources } = cardToRows(card);
    const restored = rowToCard({
      ...row,
      related_card_ids: null,
      card_sources: sources,
    });
    expect(restored.related_card_ids).toEqual([]);
  });

  it("出典の無い行はスキーマ違反として拒否する", () => {
    const { card: row } = cardToRows(card);
    expect(() => rowToCard({ ...row, card_sources: [] })).toThrow();
  });
});

describe("rowToReviewState", () => {
  it("タイムゾーン付きのタイムスタンプを ISO(UTC)に正規化する", () => {
    const s = rowToReviewState({
      user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      card_id: card.id,
      stability: 1,
      stability_fast: 0.5,
      difficulty: 3,
      due_at: "2026-01-02T09:00:00+09:00",
      last_reviewed_at: null,
      reps: 1,
      lapses: 0,
      state: "review",
      scheduled_days: 1,
      learning_step: 0,
      updated_at: "2026-01-01T00:00:00+00:00",
    });
    expect(s.due_at).toBe("2026-01-02T00:00:00.000Z");
    expect("updated_at" in s).toBe(false);
  });
});

describe("rowToSubject", () => {
  it("category_label の null を受け付け、任意の slug カテゴリを通す", () => {
    const subject = rowToSubject({
      id: "s3",
      name: "S3",
      category: "object-storage",
      category_label: null,
      description_ja: "x",
      official_urls: ["https://example.com/"],
      license_note: "",
      version: 1,
      crawled_at: "2026-11-01T00:00:00+00:00",
      is_published: true,
      created_at: "2026-11-01T00:00:00+00:00",
      updated_at: "2026-11-01T00:00:00+00:00",
    });
    expect(subject.category).toBe("object-storage");
    expect(subject.category_label).toBeNull();
    expect(subject.crawled_at).toBe("2026-11-01T00:00:00.000Z");
  });
});
