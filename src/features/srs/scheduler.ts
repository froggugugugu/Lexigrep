/**
 * FSRS(ts-fsrs 6 / FSRS-7)の薄いラッパー。
 *
 * - 純粋関数: 入力(状態・回答・現在時刻)から次の状態を返す。副作用なし
 * - 決定論: fuzz を無効化し、同じ入力は常に同じ出力
 * - 回答は正誤の 2 値。FSRS の 4 段階評価へは
 *   correct → Good / incorrect → Again に固定で写像する(【仮定】Hard / Easy は使わない)
 */
import {
  DefaultScheduler,
  Rating,
  State,
  type DefaultSchedulerCard,
  type DefaultSchedulerCardInput,
} from "ts-fsrs";
import type { ReviewStateName, SrsState } from "@/shared/content/schema";

export type { SrsState };

export type Answer = "correct" | "incorrect";

/** 「定着」とみなす安定度(日)。約 3 週間、90% の想起率で保持できる状態 */
export const MASTERY_STABILITY_DAYS = 21;

export type Scheduler = DefaultScheduler<"FSRS-7">;
type FsrsCardInput = DefaultSchedulerCardInput<"FSRS-7">;
type FsrsCardOutput = DefaultSchedulerCard<"FSRS-7">;

let schedulerPromise: Promise<Scheduler> | null = null;

/** スケジューラは生成コストがあるためプロセス内で 1 つを共有する */
export function getScheduler(): Promise<Scheduler> {
  schedulerPromise ??= DefaultScheduler<"FSRS-7">({
    version: "FSRS-7",
    enableFuzz: false,
    desiredRetention: 0.9,
  }).catch((err: unknown) => {
    schedulerPromise = null; // 失敗した Promise をキャッシュしない
    throw err;
  });
  return schedulerPromise;
}

const STATE_TO_NAME: Record<number, ReviewStateName> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const NAME_TO_STATE: Record<ReviewStateName, FsrsCardInput["state"]> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

/** ts-fsrs の scheduleStatus は relearning を learning として扱う */
const NAME_TO_SCHEDULE_STATUS: Record<
  ReviewStateName,
  FsrsCardInput["scheduleStatus"]
> = {
  new: "new",
  learning: "learning",
  review: "review",
  relearning: "learning",
};

export function answerToRating(
  answer: Answer,
): typeof Rating.Good | typeof Rating.Again {
  return answer === "correct" ? Rating.Good : Rating.Again;
}

/** 未学習カードの初期状態(due は now = 直ちに出題可能) */
export function newSrsState(now: Date): SrsState {
  return {
    stability: 0,
    stability_fast: 0,
    difficulty: 0,
    due_at: now.toISOString(),
    last_reviewed_at: null,
    reps: 0,
    lapses: 0,
    state: "new",
    scheduled_days: 0,
    learning_step: 0,
  };
}

function toFsrsCard(state: SrsState, cardId: string): FsrsCardInput {
  return {
    cardId,
    stability: state.stability,
    stabilityFast: state.stability_fast,
    difficulty: state.difficulty,
    state: NAME_TO_STATE[state.state],
    scheduleStatus: NAME_TO_SCHEDULE_STATUS[state.state],
    dueAt: new Date(state.due_at),
    lastReviewAt: state.last_reviewed_at
      ? new Date(state.last_reviewed_at)
      : null,
    reps: state.reps,
    lapses: state.lapses,
    scheduledDays: state.scheduled_days,
    learningStep: state.learning_step,
  };
}

function fromFsrsCard(card: FsrsCardOutput): SrsState {
  return {
    stability: card.stability,
    stability_fast: card.stabilityFast,
    difficulty: card.difficulty,
    due_at: new Date(card.dueAt).toISOString(),
    last_reviewed_at: card.lastReviewAt
      ? new Date(card.lastReviewAt).toISOString()
      : null,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_NAME[card.state] ?? "new",
    scheduled_days: card.scheduledDays,
    learning_step: card.learningStep ?? 0,
  };
}

/**
 * 回答を反映した次の SRS 状態を返す。
 * @param cardId FSRS 内部の識別に使う(出力には含まれない)
 */
export function reviewCard(
  scheduler: Scheduler,
  state: SrsState,
  cardId: string,
  answer: Answer,
  now: Date,
): SrsState {
  const result = scheduler.review({
    card: toFsrsCard(state, cardId),
    grade: answerToRating(answer),
    now,
  });
  return fromFsrsCard(result.card);
}

/** 出題期限が来ているか(新規カードは常に true) */
export function isDue(state: SrsState, now: Date): boolean {
  if (state.state === "new") return true;
  return new Date(state.due_at).getTime() <= now.getTime();
}

/** 定着判定: review 状態かつ安定度が閾値以上 */
export function isMastered(state: SrsState): boolean {
  return state.state === "review" && state.stability >= MASTERY_STABILITY_DAYS;
}
