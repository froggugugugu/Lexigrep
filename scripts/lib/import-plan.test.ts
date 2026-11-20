import { describe, expect, it } from "vitest";
import type { Card } from "../../src/shared/content/schema";
import { planImport, planSourceDeletes } from "./import-plan";

const card = (id: string): Card => ({
  id,
  subject_id: "typescript",
  layer: "vocab",
  target: "w",
  sentence: "w",
  highlight: { start: 0, end: 1 },
  meaning_ja: "x",
  note_ja: null,
  question_type: "choose_meaning",
  prompt_ja: null,
  choices: { options: ["a", "b"], answer: 0 },
  frequency_rank: 1,
  related_card_ids: [],
  generated_by: "human",
  reviewed_by: null,
  status: "draft",
  sources: [
    {
      url: "https://e.com/",
      title: "t",
      fetched_at: "2026-11-01T00:00:00.000Z",
      attribution: null,
    },
  ],
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
});
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("planImport", () => {
  it("パッケージに無い draft は削除、公開済みは retire、retired は放置する", () => {
    const plan = planImport(
      [
        { id: A, status: "published", reviewed_by: "o" },
        { id: B, status: "draft", reviewed_by: null },
        { id: C, status: "published", reviewed_by: "o" },
        { id: D, status: "retired", reviewed_by: "o" },
      ],
      [card(A)],
    );
    expect(plan.upsert.map((c) => c.id)).toEqual([A]);
    expect(plan.delete).toEqual([B]);
    expect(plan.retire).toEqual([C]);
  });

  it("0 枚のパッケージは中断する", () => {
    expect(() =>
      planImport([{ id: A, status: "published", reviewed_by: "o" }], []),
    ).toThrow(/0 枚/);
  });
});

describe("planSourceDeletes", () => {
  it("新しい出典に無い (card_id, url) だけを削除対象にする", () => {
    const del = planSourceDeletes(
      [
        { card_id: A, url: "https://e.com/1" },
        { card_id: A, url: "https://e.com/2" },
      ],
      [{ card_id: A, url: "https://e.com/1" }],
    );
    expect(del).toEqual([{ card_id: A, url: "https://e.com/2" }]);
  });
});
