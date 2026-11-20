"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cardResultSchema,
  layerSchema,
  subjectIdSchema,
} from "@/shared/content/schema";
import { requireUser } from "@/features/auth/require-user";
import {
  getScheduler,
  newSrsState,
  reviewCard,
} from "@/features/srs/scheduler";

const answerInputSchema = z.object({
  cardId: z.uuid(),
  answer: z.enum(["correct", "incorrect"]),
});

const ANSWER_DEBOUNCE_MS = 1000;

export type AnswerResult =
  | { ok: true; nextDueAt: string; state: string }
  | { ok: false; message: string };

/** 1 カードの回答を SRS 状態に反映する(セッション途中で離脱しても進捗が残るよう毎回保存) */
export async function answerCardAction(input: unknown): Promise<AnswerResult> {
  const parsed = answerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "入力が不正です" };
  const { user, repos } = await requireUser();
  const { cardId, answer } = parsed.data;

  const card = await repos.content.getCard(cardId);
  if (!card) return { ok: false, message: "カードが見つかりません" };

  const now = new Date();
  const states = await repos.learning.getReviewStates(user.id, [cardId]);
  const current = states.get(cardId) ?? newSrsState(now);
  // 同じ回答の二重送信・連打で reps や安定度が水増しされないよう、直近の保存から短時間は無視する
  if (
    current.last_reviewed_at &&
    now.getTime() - new Date(current.last_reviewed_at).getTime() <
      ANSWER_DEBOUNCE_MS
  ) {
    return { ok: true, nextDueAt: current.due_at, state: current.state };
  }
  const scheduler = await getScheduler();
  const next = reviewCard(scheduler, current, cardId, answer, now);
  await repos.learning.upsertReviewState(user.id, cardId, next);
  return { ok: true, nextDueAt: next.due_at, state: next.state };
}

const completeInputSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  subjectId: subjectIdSchema.nullable(),
  layer: layerSchema.nullable(),
  results: z.array(cardResultSchema).max(100),
});

export type CompleteResult =
  { ok: true; logId: string } | { ok: false; message: string };

/** セッション完了を記録する(結果は最初の回答のみ。再出題分は SRS にだけ反映済み) */
export async function completeSessionAction(
  input: unknown,
): Promise<CompleteResult> {
  const parsed = completeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "入力が不正です" };
  const { user, repos } = await requireUser();
  const { startedAt, subjectId, layer } = parsed.data;
  // card_id の重複を除き、公開済みカードだけを記録する(クライアント側の値を信用しない)
  const seen = new Set<string>();
  const unique = parsed.data.results.filter((r) =>
    seen.has(r.card_id) ? false : (seen.add(r.card_id), true),
  );
  const known = new Set(
    (await repos.content.getCards(unique.map((r) => r.card_id))).map(
      (c) => c.id,
    ),
  );
  const results = unique.filter((r) => known.has(r.card_id));
  const endedAt = new Date().toISOString();
  const started =
    new Date(startedAt).getTime() <= Date.parse(endedAt) ? startedAt : endedAt;
  const log = await repos.learning.addSessionLog(user.id, {
    started_at: started,
    ended_at: endedAt,
    subject_id: subjectId,
    layer,
    card_results: results,
  });
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/subjects");
  return { ok: true, logId: log.id };
}
