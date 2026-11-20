import { describe, expect, it } from "vitest";
import type { Card, SessionLog } from "@/shared/content/schema";
import { newSrsState, type SrsState } from "@/features/srs/scheduler";
import {
  accuracyOf,
  computeDailyActivity,
  computeStreak,
  computeSubjectProgress,
  computeTermProgress,
  studyDatesOf,
  toLocalDate,
} from "./stats";

const TZ = "Asia/Tokyo";

function log(
  endedAtIso: string,
  results: { correct: boolean }[] = [],
): SessionLog {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    started_at: endedAtIso,
    ended_at: endedAtIso,
    subject_id: null,
    layer: null,
    card_results: results.map((r, i) => ({
      card_id: `${i}0000000-0000-4000-8000-000000000000`.slice(0, 36),
      correct: r.correct,
      elapsed_ms: 1000,
    })),
  };
}

describe("toLocalDate", () => {
  it("UTC の深夜前でも東京では翌日になる", () => {
    expect(toLocalDate("2026-01-10T16:00:00.000Z", TZ)).toBe("2026-01-11");
    expect(toLocalDate("2026-01-10T14:59:59.000Z", TZ)).toBe("2026-01-10");
  });
});

describe("computeStreak", () => {
  it("今日を含めて連続日数を数える", () => {
    const dates = new Set(["2026-01-08", "2026-01-09", "2026-01-10"]);
    expect(computeStreak(dates, "2026-01-10")).toBe(3);
  });

  it("今日が未学習でも昨日まで続いていれば維持される", () => {
    const dates = new Set(["2026-01-08", "2026-01-09"]);
    expect(computeStreak(dates, "2026-01-10")).toBe(2);
  });

  it("一昨日で途切れていれば 0", () => {
    const dates = new Set(["2026-01-07", "2026-01-08"]);
    expect(computeStreak(dates, "2026-01-10")).toBe(0);
  });

  it("月跨ぎでも連続と判定する", () => {
    const dates = new Set(["2026-01-31", "2026-02-01"]);
    expect(computeStreak(dates, "2026-02-01")).toBe(2);
  });
});

describe("studyDatesOf", () => {
  it("ログの終了時刻をローカル日付に変換して集合にする", () => {
    const dates = studyDatesOf(
      [log("2026-01-10T16:00:00.000Z"), log("2026-01-10T17:00:00.000Z")],
      TZ,
    );
    expect([...dates]).toEqual(["2026-01-11"]);
  });
});

describe("computeSubjectProgress", () => {
  const T0 = new Date("2026-01-10T00:00:00.000Z");
  const mk = (id: string, subject: string): Card => ({
    id: `${id}0000000-0000-4000-8000-000000000000`.slice(0, 36),
    subject_id: subject,
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
    reviewed_by: "o",
    status: "published",
    sources: [
      {
        url: "https://e.com/",
        title: "t",
        fetched_at: T0.toISOString(),
        attribution: null,
      },
    ],
    created_at: T0.toISOString(),
    updated_at: T0.toISOString(),
  });

  it("題材ごとに total / learned / mastered / due を数える", () => {
    const a = mk("a", "typescript");
    const b = mk("b", "typescript");
    const c = mk("c", "nextjs");
    const states = new Map<string, SrsState>([
      [
        a.id,
        {
          ...newSrsState(T0),
          state: "review",
          stability: 30,
          due_at: "2026-01-20T00:00:00.000Z",
        },
      ],
      [
        b.id,
        {
          ...newSrsState(T0),
          state: "learning",
          stability: 1,
          due_at: "2026-01-09T00:00:00.000Z",
        },
      ],
    ]);
    const rows = computeSubjectProgress([a, b, c], states, T0);
    expect(rows).toEqual([
      {
        subjectId: "nextjs",
        total: 1,
        learned: 0,
        mastered: 0,
        due: 0,
        masteryRate: 0,
      },
      {
        subjectId: "typescript",
        total: 2,
        learned: 2,
        mastered: 1,
        due: 1,
        masteryRate: 0.5,
      },
    ]);
  });
});

describe("computeDailyActivity / accuracyOf", () => {
  it("直近 N 日を古い順に並べ、該当日の枚数と正解数を集計する", () => {
    const logs = [
      log("2026-01-10T01:00:00.000Z", [{ correct: true }, { correct: false }]),
      log("2026-01-09T01:00:00.000Z", [{ correct: true }]),
      log("2026-01-01T01:00:00.000Z", [{ correct: true }]),
    ];
    const rows = computeDailyActivity(logs, TZ, "2026-01-10", 3);
    expect(rows).toEqual([
      { date: "2026-01-08", cards: 0, correct: 0 },
      { date: "2026-01-09", cards: 1, correct: 1 },
      { date: "2026-01-10", cards: 2, correct: 1 },
    ]);
    expect(accuracyOf(logs)).toBeCloseTo(0.75);
    expect(accuracyOf([])).toBeNull();
  });
});

describe("computeTermProgress", () => {
  it("同じ語句のカードを 1 語として数える", () => {
    const T0 = new Date("2026-01-10T00:00:00.000Z");
    const mk = (id: string, target: string) =>
      ({
        id: `${id}0000000-0000-4000-8000-000000000000`.slice(0, 36),
        target,
      }) as Card;
    const a = mk("a", "deprecated");
    const b = mk("b", "Deprecated");
    const c = mk("c", "resolve");
    const states = new Map<string, SrsState>([
      [a.id, { ...newSrsState(T0), state: "review", stability: 30 }],
    ]);
    expect(computeTermProgress([a, b, c], states)).toEqual({
      total: 2,
      learned: 1,
      mastered: 1,
    });
  });
});
