/**
 * DB 行 ⇔ ドメイン型の変換。
 * DB では highlight を int4range、出典を card_sources テーブルに持つため、ここで吸収する。
 */
import { z } from "zod";
import {
  cardSchema,
  cardStatusSchema,
  choicesSchema,
  layerSchema,
  questionTypeSchema,
  reviewStateSchema,
  sessionLogSchema,
  sourceSchema,
  subjectSchema,
  type Card,
  type ReviewState,
  type SessionLog,
  type Source,
  type SrsState,
  type Subject,
  type UserSettings,
  userSettingsSchema,
} from "@/shared/content/schema";

/** PostgreSQL の int4range 正規形 "[start,end)" を解釈する */
export function parseInt4Range(text: string): { start: number; end: number } {
  const m = /^([[(])(-?\d+),(-?\d+)([\])])$/.exec(text.trim());
  if (!m) throw new Error(`int4range として解釈できない: ${text}`);
  let start = Number(m[2]);
  let end = Number(m[3]);
  if (m[1] === "(") start += 1;
  if (m[4] === "]") end += 1;
  return { start, end };
}

export function formatInt4Range(r: { start: number; end: number }): string {
  return `[${r.start},${r.end})`;
}

const timestamp = z.string().min(1);

export const subjectRowSchema = subjectSchema.extend({
  created_at: timestamp.optional(),
  updated_at: timestamp.optional(),
});

export const cardSourceRowSchema = sourceSchema.extend({
  id: z.uuid().optional(),
  card_id: z.uuid().optional(),
});

export const cardRowSchema = z.object({
  id: z.uuid(),
  subject_id: z.string(),
  layer: layerSchema,
  target: z.string(),
  sentence: z.string(),
  highlight: z.string(),
  meaning_ja: z.string(),
  note_ja: z.string().nullable(),
  question_type: questionTypeSchema,
  prompt_ja: z.string().nullable(),
  choices: choicesSchema,
  frequency_rank: z.number().int(),
  related_card_ids: z.array(z.uuid()).nullable(),
  generated_by: z.string(),
  reviewed_by: z.string().nullable(),
  status: cardStatusSchema,
  created_at: timestamp,
  updated_at: timestamp,
  card_sources: z.array(cardSourceRowSchema).default([]),
});
export type CardRow = z.infer<typeof cardRowSchema>;

function toIso(ts: string): string {
  return new Date(ts).toISOString();
}

export function rowToSubject(row: unknown): Subject {
  const r = subjectRowSchema.parse(row);
  const { created_at: _c, updated_at: _u, ...subject } = r;
  return {
    ...subject,
    crawled_at: subject.crawled_at ? toIso(subject.crawled_at) : null,
  };
}

export function rowToCard(row: unknown): Card {
  const r = cardRowSchema.parse(row);
  // 埋め込みの並びは不定なので URL 順に固定する(sources[0] を出典として表示するため)
  const sources: Source[] = [...r.card_sources]
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((s) => ({
      url: s.url,
      title: s.title,
      fetched_at: toIso(s.fetched_at),
      attribution: s.attribution ?? null,
    }));
  return cardSchema.parse({
    id: r.id,
    subject_id: r.subject_id,
    layer: r.layer,
    target: r.target,
    sentence: r.sentence,
    highlight: parseInt4Range(r.highlight),
    meaning_ja: r.meaning_ja,
    note_ja: r.note_ja,
    question_type: r.question_type,
    prompt_ja: r.prompt_ja,
    choices: r.choices,
    frequency_rank: r.frequency_rank,
    related_card_ids: r.related_card_ids ?? [],
    generated_by: r.generated_by,
    reviewed_by: r.reviewed_by,
    status: r.status,
    sources,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  });
}

/** cards テーブルへの upsert 行(出典は別テーブル) */
export type CardInsertRow = Omit<Card, "highlight" | "sources"> & {
  highlight: string;
};
export type CardSourceInsertRow = Source & { card_id: string };

export function cardToRows(card: Card): {
  card: CardInsertRow;
  sources: CardSourceInsertRow[];
} {
  const { highlight, sources, ...rest } = card;
  return {
    card: { ...rest, highlight: formatInt4Range(highlight) },
    sources: sources.map((s) => ({ ...s, card_id: card.id })),
  };
}

export const reviewStateRowSchema = reviewStateSchema.extend({
  due_at: timestamp,
  last_reviewed_at: timestamp.nullable(),
  updated_at: timestamp.optional(),
});

export function rowToReviewState(row: unknown): ReviewState {
  const r = reviewStateRowSchema.parse(row);
  const { updated_at: _u, ...rest } = r;
  return reviewStateSchema.parse({
    ...rest,
    due_at: toIso(r.due_at),
    last_reviewed_at: r.last_reviewed_at ? toIso(r.last_reviewed_at) : null,
  });
}

export function reviewStateToRow(
  userId: string,
  cardId: string,
  state: SrsState,
): ReviewState {
  return { ...state, user_id: userId, card_id: cardId };
}

export const sessionLogRowSchema = sessionLogSchema.extend({
  started_at: timestamp,
  ended_at: timestamp,
  created_at: timestamp.optional(),
});

export function rowToSessionLog(row: unknown): SessionLog {
  const r = sessionLogRowSchema.parse(row);
  const { created_at: _c, ...rest } = r;
  return sessionLogSchema.parse({
    ...rest,
    started_at: toIso(r.started_at),
    ended_at: toIso(r.ended_at),
  });
}

export const userSettingsRowSchema = userSettingsSchema.extend({
  created_at: timestamp.optional(),
  updated_at: timestamp.optional(),
});

export function rowToUserSettings(row: unknown): UserSettings {
  const r = userSettingsRowSchema.parse(row);
  return {
    user_id: r.user_id,
    session_size: r.session_size,
    theme: r.theme,
    learning_goal: r.learning_goal,
    focus_subject_id: r.focus_subject_id,
  };
}
