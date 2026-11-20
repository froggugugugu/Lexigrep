import { describe, expect, it } from "vitest";
import type { Card } from "@/shared/content/schema";
import { newSrsState, type SrsState } from "@/features/srs/scheduler";
import { buildSession, estimateMinutes, matchesFilter } from "./build-session";

const T0 = new Date("2026-01-10T00:00:00.000Z");
const iso = (d: Date) => d.toISOString();
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

function card(
  id: string,
  subject: string,
  rank: number,
  layer: Card["layer"] = "vocab",
): Card {
  const sentence = `word ${id}`;
  return {
    id: `${id}0000000-0000-4000-8000-000000000000`.slice(0, 36),
    subject_id: subject,
    layer,
    target: "word",
    sentence,
    highlight: { start: 0, end: 4 },
    meaning_ja: "語",
    note_ja: null,
    question_type: "choose_meaning",
    prompt_ja: null,
    choices: { options: ["a", "b"], answer: 0 },
    frequency_rank: rank,
    related_card_ids: [],
    generated_by: "human",
    reviewed_by: "owner",
    status: "published",
    sources: [
      {
        url: "https://example.com/",
        title: "x",
        fetched_at: iso(T0),
        attribution: null,
      },
    ],
    created_at: iso(T0),
    updated_at: iso(T0),
  };
}

function reviewState(dueAt: Date): SrsState {
  return { ...newSrsState(T0), state: "review", reps: 1, due_at: iso(dueAt) };
}

const c1 = card("a", "typescript", 1);
const c2 = card("b", "typescript", 2, "pattern");
const c3 = card("c", "nextjs", 1);
const c4 = card("d", "nextjs", 3);
const c5 = card("e", "typescript", 5);

describe("matchesFilter", () => {
  it("null は全件一致、指定時は題材・層で絞る", () => {
    expect(matchesFilter(c1, { subjectId: null, layers: null })).toBe(true);
    expect(matchesFilter(c1, { subjectId: "nextjs", layers: null })).toBe(
      false,
    );
    expect(
      matchesFilter(c2, { subjectId: "typescript", layers: ["pattern"] }),
    ).toBe(true);
    expect(
      matchesFilter(c2, { subjectId: "typescript", layers: ["vocab"] }),
    ).toBe(false);
  });
});

describe("buildSession", () => {
  it("期限切れの復習カードを期限の古い順に最優先で含める", () => {
    const states = new Map<string, SrsState>([
      [c4.id, reviewState(days(-1))],
      [c2.id, reviewState(days(-3))],
      [c1.id, reviewState(days(+2))], // 未到来
    ]);
    const plan = buildSession({
      cards: [c1, c2, c3, c4, c5],
      states,
      filter: { subjectId: null, layers: null },
      size: 3,
      now: T0,
    });
    expect(plan.cards.map((c) => c.id)).toEqual([c2.id, c4.id, c3.id]);
    expect(plan.dueCount).toBe(2);
    expect(plan.newCount).toBe(1);
  });

  it("未学習カードは頻度順位の小さい順、同順位は題材 id 順", () => {
    const plan = buildSession({
      cards: [c5, c4, c3, c2, c1],
      states: new Map(),
      filter: { subjectId: null, layers: null },
      size: 10,
      now: T0,
    });
    // rank1: nextjs(c3) < typescript(c1), rank2: c2, rank3: c4, rank5: c5
    expect(plan.cards.map((c) => c.id)).toEqual([
      c3.id,
      c1.id,
      c2.id,
      c4.id,
      c5.id,
    ]);
    expect(plan.newCount).toBe(5);
  });

  it("枚数は size で打ち切る", () => {
    const plan = buildSession({
      cards: [c1, c2, c3, c4, c5],
      states: new Map(),
      filter: { subjectId: null, layers: null },
      size: 2,
      now: T0,
    });
    expect(plan.cards).toHaveLength(2);
  });

  it("題材・層の絞り込みが効く", () => {
    const plan = buildSession({
      cards: [c1, c2, c3, c4, c5],
      states: new Map(),
      filter: { subjectId: "typescript", layers: ["pattern"] },
      size: 10,
      now: T0,
    });
    expect(plan.cards.map((c) => c.id)).toEqual([c2.id]);
  });

  it("出題できるカードが無ければ空のセッションを返す", () => {
    const states = new Map<string, SrsState>([[c1.id, reviewState(days(+1))]]);
    const plan = buildSession({
      cards: [c1],
      states,
      filter: { subjectId: null, layers: null },
      size: 5,
      now: T0,
    });
    expect(plan.cards).toEqual([]);
    expect(plan.estimatedMinutes).toBe(1);
  });

  it("同じ入力からは同じ順序を返す(決定論)", () => {
    const input = {
      cards: [c5, c1, c4, c2, c3],
      states: new Map<string, SrsState>([[c4.id, reviewState(days(-1))]]),
      filter: { subjectId: null, layers: null },
      size: 4,
      now: T0,
    };
    expect(buildSession(input)).toEqual(
      buildSession({ ...input, cards: [...input.cards].reverse() }),
    );
  });
});

describe("estimateMinutes", () => {
  it("約 20 秒/枚で分に丸める(最小 1 分)", () => {
    expect(estimateMinutes(12)).toBe(4);
    expect(estimateMinutes(20)).toBe(7);
    expect(estimateMinutes(8)).toBe(3);
    expect(estimateMinutes(0)).toBe(1);
  });
});

describe("buildSession: 題材横断(dedupeTerms)", () => {
  const same = (
    id: string,
    subject: string,
    target: string,
    rank: number,
    layer: Card["layer"] = "vocab",
  ): Card => ({
    ...card(id, subject, rank, layer),
    target,
    sentence: `${target} here`,
    highlight: { start: 0, end: target.length },
  });
  const filter = {
    subjectId: null,
    layers: ["vocab", "pattern", "idiom"],
    dedupeTerms: true,
  } as const;
  const a = same("a", "typescript", "deprecated", 5);
  const b = same("b", "nextjs", "Deprecated", 9);
  const c = same("c", "typescript", "assignable", 1);
  const d = same("d", "typescript", "out of the box", 1, "idiom");

  it("同じ語句は 1 回だけ出し、多くの題材に出る語句を優先し、慣用句は後に回す", () => {
    const plan = buildSession({
      cards: [d, c, b, a],
      states: new Map(),
      filter,
      size: 10,
      now: T0,
    });
    expect(plan.cards.map((x) => x.id)).toEqual([a.id, c.id, d.id]);
  });

  it("別の題材で学習済みの語句は未学習の語句の後に回す", () => {
    const states = new Map<string, SrsState>([[a.id, reviewState(days(+5))]]);
    const plan = buildSession({
      cards: [a, b, c],
      states,
      filter,
      size: 10,
      now: T0,
    });
    expect(plan.cards.map((x) => x.id)).toEqual([c.id, b.id]);
  });

  it("特有語は対象の層に含まれない", () => {
    const term = same("e", "typescript", "narrowing", 1, "system_term");
    const plan = buildSession({
      cards: [term, c],
      states: new Map(),
      filter,
      size: 10,
      now: T0,
    });
    expect(plan.cards.map((x) => x.id)).toEqual([c.id]);
  });
});
