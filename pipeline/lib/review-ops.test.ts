import { describe, expect, it } from "vitest";
import type { Card } from "../../src/shared/content/schema";
import {
  applyDecision,
  publishReviewed,
  renderCard,
  summarize,
} from "./review-ops";

const T0 = new Date("2026-11-02T00:00:00.000Z");
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
  generated_by: "claude",
  reviewed_by: null,
  status: "draft",
  sources: [
    {
      url: "https://www.typescriptlang.org/docs/",
      title: "Docs",
      fetched_at: "2026-11-01T00:00:00.000Z",
      attribution: null,
    },
  ],
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
};

describe("applyDecision", () => {
  it("承認で reviewed、却下で retired になりレビュー者と更新日時が付く", () => {
    const a = applyDecision(card, "approve", "owner", T0);
    expect(a.status).toBe("reviewed");
    expect(a.reviewed_by).toBe("owner");
    expect(a.updated_at).toBe(T0.toISOString());
    expect(applyDecision(card, "reject", "owner", T0).status).toBe("retired");
  });

  it("修正は検証済みの内容で置き換え、id の変更は拒否する", () => {
    const edited = { ...card, meaning_ja: "〜へ代入できない" };
    const e = applyDecision(card, "edit", "owner", T0, edited);
    expect(e.meaning_ja).toBe("〜へ代入できない");
    expect(e.status).toBe("reviewed");
    expect(() =>
      applyDecision(card, "edit", "owner", T0, {
        ...edited,
        id: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow();
    expect(() =>
      applyDecision(card, "edit", "owner", T0, {
        ...edited,
        highlight: { start: 0, end: 4 },
      }),
    ).toThrow();
  });
});

describe("publishReviewed / summarize", () => {
  it("reviewed だけを published にし、件数を返す", () => {
    const reviewed = applyDecision(card, "approve", "owner", T0);
    const r = publishReviewed([card, reviewed], T0);
    expect(r.count).toBe(1);
    expect(summarize(r.cards)).toEqual({
      draft: 1,
      reviewed: 0,
      published: 1,
      retired: 0,
    });
  });
});

describe("renderCard", () => {
  it("ハイライトを « » で囲み、正解に ✔ を付ける", () => {
    const text = renderCard(card, 0, 3);
    expect(text).toContain("«is not assignable to»");
    expect(text).toContain("✔ 1. a");
    expect(text).toContain("[1/3]");
  });
});
