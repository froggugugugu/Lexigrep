import "server-only";
import type {
  Card,
  SessionLog,
  SrsState,
  Subject,
  UserSettings,
} from "@/shared/content/schema";
import type { Repositories } from "@/infrastructure/repositories/types";
import { buildSession } from "@/features/session/build-session";
import { filterForGoal } from "@/features/session/course";
import { isMastered } from "@/features/srs/scheduler";
import {
  accuracyOf,
  computeDailyActivity,
  computeStreak,
  computeSubjectProgress,
  studyDatesOf,
  toLocalDate,
  type DailyActivity,
  type SubjectProgress,
} from "./stats";

export type Overview = {
  subjects: Subject[];
  cards: Card[];
  states: Map<string, SrsState>;
  logs: SessionLog[];
  settings: UserSettings;
  today: string;
  streak: number;
  progress: SubjectProgress[];
  totals: { cards: number; learned: number; mastered: number; due: number };
  /** 今日のセッション見込み */
  plan: { count: number; due: number; fresh: number; minutes: number };
  activity: DailyActivity[];
  accuracy30d: number | null;
};

/** 連続日数の上限に相当する取得範囲(これを超える連続記録は頭打ちになる) */
const LOG_WINDOW_DAYS = 400;

export async function loadOverview(
  repos: Repositories,
  userId: string,
  timeZone: string,
  now: Date,
): Promise<Overview> {
  const since = new Date(now.getTime() - LOG_WINDOW_DAYS * 86_400_000);
  const [subjects, cards, states, logs, settings] = await Promise.all([
    repos.content.listSubjects(),
    repos.content.listCards(),
    repos.learning.getReviewStates(userId),
    repos.learning.listSessionLogs(userId, { since }),
    repos.learning.getSettings(userId),
  ]);

  const today = toLocalDate(now.toISOString(), timeZone);
  const streak = computeStreak(studyDatesOf(logs, timeZone), today);
  const progress = computeSubjectProgress(cards, states, now);
  const totals = progress.reduce(
    (acc, p) => ({
      cards: acc.cards + p.total,
      learned: acc.learned + p.learned,
      mastered: acc.mastered + p.mastered,
      due: acc.due + p.due,
    }),
    { cards: 0, learned: 0, mastered: 0, due: 0 },
  );
  const planned = buildSession({
    cards,
    states,
    filter: filterForGoal(settings),
    size: settings.session_size,
    now,
  });
  const since30 = new Date(now.getTime() - 30 * 86_400_000).getTime();
  const logs30 = logs.filter((l) => new Date(l.ended_at).getTime() >= since30);

  return {
    subjects,
    cards,
    states,
    logs,
    settings,
    today,
    streak,
    progress,
    totals,
    plan: {
      count: planned.cards.length,
      due: planned.dueCount,
      fresh: planned.newCount,
      minutes: planned.estimatedMinutes,
    },
    activity: computeDailyActivity(logs, timeZone, today, 14),
    accuracy30d: accuracyOf(logs30),
  };
}

export type SrsLabel = "新規" | "学習中" | "復習" | "再学習" | "定着";

export function srsLabel(state: SrsState | undefined): SrsLabel {
  if (!state || state.state === "new") return "新規";
  if (isMastered(state)) return "定着";
  switch (state.state) {
    case "learning":
      return "学習中";
    case "relearning":
      return "再学習";
    default:
      return "復習";
  }
}
