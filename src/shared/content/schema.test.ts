import { describe, expect, it } from "vitest";
import {
  cardSchema,
  choicesSchema,
  manifestSchema,
  subjectSchema,
  type Card,
} from "./schema";

const validCard: Card = {
  id: "11111111-1111-4111-8111-111111111111",
  subject_id: "typescript",
  layer: "pattern",
  target: "is not assignable to",
  sentence: "Type 'string' is not assignable to type 'number'.",
  highlight: { start: 14, end: 34 },
  meaning_ja: "〜に代入できない",
  note_ja: "型エラーの定型文。前が実際の型、後ろが期待される型。",
  question_type: "choose_meaning",
  prompt_ja: null,
  choices: {
    options: [
      "〜に代入できない",
      "〜に割り当て済み",
      "〜と互換がある",
      "〜を推論できない",
    ],
    answer: 0,
  },
  frequency_rank: 1,
  related_card_ids: [],
  generated_by: "human",
  reviewed_by: null,
  status: "draft",
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

describe("cardSchema", () => {
  it("正しいカードを受理する", () => {
    expect(cardSchema.safeParse(validCard).success).toBe(true);
  });

  it("highlight 範囲が target と一致しないと拒否する", () => {
    const r = cardSchema.safeParse({
      ...validCard,
      highlight: { start: 0, end: 4 },
    });
    expect(r.success).toBe(false);
  });

  it("highlight.end が sentence より長いと拒否する", () => {
    const r = cardSchema.safeParse({
      ...validCard,
      highlight: { start: 14, end: 999 },
    });
    expect(r.success).toBe(false);
  });

  it("出典が 0 件なら拒否する(実文に紐づく学習の原則)", () => {
    const r = cardSchema.safeParse({ ...validCard, sources: [] });
    expect(r.success).toBe(false);
  });

  it("draft 以外で reviewed_by が null なら拒否する", () => {
    const r = cardSchema.safeParse({ ...validCard, status: "published" });
    expect(r.success).toBe(false);
    const ok = cardSchema.safeParse({
      ...validCard,
      status: "published",
      reviewed_by: "owner",
    });
    expect(ok.success).toBe(true);
  });

  it("related_card_ids に自分自身を含めると拒否する", () => {
    const r = cardSchema.safeParse({
      ...validCard,
      related_card_ids: [validCard.id],
    });
    expect(r.success).toBe(false);
  });

  it("省略可能な項目は既定値で補完される", () => {
    const {
      note_ja: _n,
      prompt_ja: _p,
      related_card_ids: _r,
      ...rest
    } = validCard;
    const r = cardSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.note_ja).toBeNull();
      expect(r.data.prompt_ja).toBeNull();
      expect(r.data.related_card_ids).toEqual([]);
    }
  });
});

describe("choicesSchema", () => {
  it("answer が範囲外なら拒否する", () => {
    expect(
      choicesSchema.safeParse({ options: ["a", "b"], answer: 2 }).success,
    ).toBe(false);
  });

  it("選択肢の重複を拒否する", () => {
    expect(
      choicesSchema.safeParse({ options: ["a", "a"], answer: 0 }).success,
    ).toBe(false);
  });

  it("選択肢は 2〜6 件", () => {
    expect(choicesSchema.safeParse({ options: ["a"], answer: 0 }).success).toBe(
      false,
    );
    expect(
      choicesSchema.safeParse({
        options: ["a", "b", "c", "d", "e", "f", "g"],
        answer: 0,
      }).success,
    ).toBe(false);
  });
});

describe("subjectSchema", () => {
  it("slug 形式でない id を拒否する", () => {
    const r = subjectSchema.safeParse({
      id: "Next.js",
      name: "Next.js",
      category: "language_fw",
      description_ja: "x",
      official_urls: ["https://nextjs.org/docs"],
      version: 1,
      crawled_at: null,
      is_published: true,
    });
    expect(r.success).toBe(false);
  });

  const subject = {
    id: "aws-s3",
    name: "Amazon S3",
    category: "language_fw",
    description_ja: "x",
    official_urls: ["https://docs.aws.amazon.com/s3/"],
    version: 1,
    crawled_at: null,
    is_published: true,
  };

  it("既知以外の slug のカテゴリと表示名を受け付ける", () => {
    const r = subjectSchema.safeParse({
      ...subject,
      category: "object-storage",
      category_label: "ストレージ",
    });
    expect(r.success).toBe(true);
    expect(subjectSchema.safeParse(subject).success).toBe(true);
  });

  it("slug でないカテゴリと長すぎる表示名を拒否する", () => {
    for (const category of ["Cloud", "a b", "-x", "x_", "a".repeat(41)]) {
      expect(subjectSchema.safeParse({ ...subject, category }).success).toBe(
        false,
      );
    }
    for (const category_label of ["", " ", "あ".repeat(41)]) {
      expect(
        subjectSchema.safeParse({ ...subject, category_label }).success,
      ).toBe(false);
    }
  });
});

describe("manifestSchema", () => {
  it("checksum は sha256 hex", () => {
    const base = {
      subject_id: "typescript",
      version: 1,
      crawled_at: null,
      card_count: 0,
      generated_at: "2026-11-01T00:00:00.000Z",
      generator: "human",
    };
    expect(manifestSchema.safeParse({ ...base, checksum: "abc" }).success).toBe(
      false,
    );
    expect(
      manifestSchema.safeParse({ ...base, checksum: "a".repeat(64) }).success,
    ).toBe(true);
  });
});
