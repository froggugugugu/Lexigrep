import { beforeAll, describe, expect, it } from "vitest";
import {
  answerToRating,
  getScheduler,
  isDue,
  isMastered,
  MASTERY_STABILITY_DAYS,
  newSrsState,
  reviewCard,
  type SrsState,
} from "./scheduler";

const CARD_ID = "11111111-1111-4111-8111-111111111111";
const T0 = new Date("2026-01-01T00:00:00.000Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

let scheduler: Awaited<ReturnType<typeof getScheduler>>;

beforeAll(async () => {
  scheduler = await getScheduler();
});

describe("answerToRating", () => {
  it("正解は Good、不正解は Again に写像する", () => {
    expect(answerToRating("correct")).toBe(3);
    expect(answerToRating("incorrect")).toBe(1);
  });
});

describe("newSrsState", () => {
  it("新規カードは直ちに出題可能で reps = 0", () => {
    const s = newSrsState(T0);
    expect(s.state).toBe("new");
    expect(s.reps).toBe(0);
    expect(isDue(s, T0)).toBe(true);
  });
});

describe("reviewCard", () => {
  it("正解すると次回期限が未来になり reps が増える", () => {
    const next = reviewCard(scheduler, newSrsState(T0), CARD_ID, "correct", T0);
    expect(next.reps).toBe(1);
    expect(new Date(next.due_at).getTime()).toBeGreaterThan(T0.getTime());
    expect(next.state).toBe("review");
    expect(next.last_reviewed_at).toBe(T0.toISOString());
  });

  it("不正解は正解より短い間隔で再出題される", () => {
    const base = newSrsState(T0);
    const good = reviewCard(scheduler, base, CARD_ID, "correct", T0);
    const again = reviewCard(scheduler, base, CARD_ID, "incorrect", T0);
    expect(new Date(again.due_at).getTime()).toBeLessThan(
      new Date(good.due_at).getTime(),
    );
    expect(again.scheduled_days).toBeLessThan(good.scheduled_days);
  });

  it("復習中の不正解は lapses を増やし relearning に戻す", () => {
    const first = reviewCard(
      scheduler,
      newSrsState(T0),
      CARD_ID,
      "correct",
      T0,
    );
    const lapse = reviewCard(scheduler, first, CARD_ID, "incorrect", days(5));
    expect(lapse.lapses).toBe(1);
    expect(lapse.state).toBe("relearning");
  });

  it("正解を重ねるほど間隔が伸びる(間隔反復)", () => {
    let s: SrsState = newSrsState(T0);
    let now = T0;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = reviewCard(scheduler, s, CARD_ID, "correct", now);
      intervals.push(s.scheduled_days);
      now = new Date(s.due_at);
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]!);
    }
  });

  it("同じ入力からは常に同じ出力が得られる(決定論)", () => {
    const a = reviewCard(scheduler, newSrsState(T0), CARD_ID, "correct", T0);
    const b = reviewCard(scheduler, newSrsState(T0), CARD_ID, "correct", T0);
    expect(a).toEqual(b);
  });

  it("入力の状態オブジェクトを変更しない(純粋関数)", () => {
    const base = newSrsState(T0);
    const snapshot = structuredClone(base);
    reviewCard(scheduler, base, CARD_ID, "correct", T0);
    expect(base).toEqual(snapshot);
  });

  it("保存した状態を復元して続きから復習できる(往復変換)", () => {
    const s1 = reviewCard(scheduler, newSrsState(T0), CARD_ID, "correct", T0);
    const restored: SrsState = JSON.parse(JSON.stringify(s1));
    const s2 = reviewCard(
      scheduler,
      restored,
      CARD_ID,
      "correct",
      new Date(s1.due_at),
    );
    expect(s2.reps).toBe(2);
    expect(s2.scheduled_days).toBeGreaterThan(s1.scheduled_days);
  });
});

describe("isDue / isMastered", () => {
  it("期限前は出題しない", () => {
    const s = reviewCard(scheduler, newSrsState(T0), CARD_ID, "correct", T0);
    expect(isDue(s, T0)).toBe(false);
    expect(isDue(s, new Date(s.due_at))).toBe(true);
  });

  it("安定度が閾値以上の review 状態を定着とみなす", () => {
    const s = newSrsState(T0);
    expect(isMastered(s)).toBe(false);
    expect(
      isMastered({ ...s, state: "review", stability: MASTERY_STABILITY_DAYS }),
    ).toBe(true);
    expect(
      isMastered({
        ...s,
        state: "relearning",
        stability: MASTERY_STABILITY_DAYS,
      }),
    ).toBe(false);
  });
});
