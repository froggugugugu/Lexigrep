/**
 * ダッシュボード用の集計(純粋関数)。
 * 日付の境界はユーザーのタイムゾーンで決める(UTC の日付では深夜の学習が前日扱いになるため)。
 */
import type { Card, SessionLog } from "@/shared/content/schema";
import { normalizeTerm } from "@/shared/content/terms";
import { isMastered, type SrsState } from "@/features/srs/scheduler";

/** ISO 日時を指定タイムゾーンの YYYY-MM-DD にする */
export function toLocalDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y!, m! - 1, d!) + deltaDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 連続学習日数。today を含めて途切れるまで遡る。
 * today に未学習でも、昨日まで続いていれば昨日までの日数を返す(今日の分はまだ途切れていない)。
 */
export function computeStreak(
  studyDates: ReadonlySet<string>,
  today: string,
): number {
  let cursor = studyDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (studyDates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

export function studyDatesOf(
  logs: readonly SessionLog[],
  timeZone: string,
): Set<string> {
  return new Set(logs.map((l) => toLocalDate(l.ended_at, timeZone)));
}

export type SubjectProgress = {
  subjectId: string;
  total: number;
  learned: number;
  mastered: number;
  due: number;
  /** 0〜1。total が 0 なら 0 */
  masteryRate: number;
};

export function computeSubjectProgress(
  cards: readonly Card[],
  states: ReadonlyMap<string, SrsState>,
  now: Date,
): SubjectProgress[] {
  const bySubject = new Map<string, SubjectProgress>();
  for (const card of cards) {
    const p =
      bySubject.get(card.subject_id) ??
      ({
        subjectId: card.subject_id,
        total: 0,
        learned: 0,
        mastered: 0,
        due: 0,
        masteryRate: 0,
      } satisfies SubjectProgress);
    p.total += 1;
    const s = states.get(card.id);
    if (s && s.state !== "new") {
      p.learned += 1;
      if (isMastered(s)) p.mastered += 1;
      if (new Date(s.due_at).getTime() <= now.getTime()) p.due += 1;
    }
    bySubject.set(card.subject_id, p);
  }
  for (const p of bySubject.values()) {
    p.masteryRate = p.total === 0 ? 0 : p.mastered / p.total;
  }
  return [...bySubject.values()].sort((a, b) =>
    a.subjectId.localeCompare(b.subjectId),
  );
}

export type DailyActivity = { date: string; cards: number; correct: number };

/** 直近 N 日の日別学習量(古い順) */
export function computeDailyActivity(
  logs: readonly SessionLog[],
  timeZone: string,
  today: string,
  days: number,
): DailyActivity[] {
  const map = new Map<string, DailyActivity>();
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDate(today, -i);
    map.set(date, { date, cards: 0, correct: 0 });
  }
  for (const log of logs) {
    const date = toLocalDate(log.ended_at, timeZone);
    const row = map.get(date);
    if (!row) continue;
    row.cards += log.card_results.length;
    row.correct += log.card_results.filter((r) => r.correct).length;
  }
  return [...map.values()];
}

export function accuracyOf(logs: readonly SessionLog[]): number | null {
  let total = 0;
  let correct = 0;
  for (const log of logs) {
    total += log.card_results.length;
    correct += log.card_results.filter((r) => r.correct).length;
  }
  return total === 0 ? null : correct / total;
}

export type TermProgress = { total: number; learned: number; mastered: number };

/** 語句単位の進捗。同じ語句のカードが複数あっても 1 語として数える */
export function computeTermProgress(
  cards: readonly Card[],
  states: ReadonlyMap<string, SrsState>,
): TermProgress {
  const terms = new Map<string, { learned: boolean; mastered: boolean }>();
  for (const card of cards) {
    const key = normalizeTerm(card.target);
    const entry = terms.get(key) ?? { learned: false, mastered: false };
    const state = states.get(card.id);
    if (state && state.state !== "new") entry.learned = true;
    if (state && isMastered(state)) entry.mastered = true;
    terms.set(key, entry);
  }
  const rows = [...terms.values()];
  return {
    total: rows.length,
    learned: rows.filter((r) => r.learned).length,
    mastered: rows.filter((r) => r.mastered).length,
  };
}
