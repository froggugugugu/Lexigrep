"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/require-user";

const reportInputSchema = z.object({
  cardId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "内容を入力してください")
    .max(1000, "1000 文字以内で入力してください"),
});

export type ReportFormState = { message: string | null; error: string | null };

/** 間違い報告(AI が下書きしたカードの誤りを利用者が報告できる) */
export async function reportCardAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const parsed = reportInputSchema.safeParse({
    cardId: formData.get("cardId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      message: null,
      error: parsed.error.issues[0]?.message ?? "入力が不正です",
    };
  }
  const { user, repos } = await requireUser();
  const card = await repos.content.getCard(parsed.data.cardId);
  if (!card) return { message: null, error: "カードが見つかりません" };
  await repos.learning.addCardReport(user.id, card.id, parsed.data.reason);
  return {
    message: "報告を受け付けました。ありがとうございます。",
    error: null,
  };
}
