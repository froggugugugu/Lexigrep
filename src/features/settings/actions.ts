"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  learningGoalSchema,
  SESSION_SIZES,
  subjectIdSchema,
  themeSchema,
} from "@/shared/content/schema";
import { requireUser } from "@/features/auth/require-user";
import { THEME_COOKIE } from "./theme";

const settingsInputSchema = z.object({
  session_size: z.coerce
    .number()
    .int()
    .refine(
      (n) => (SESSION_SIZES as readonly number[]).includes(n),
      "枚数が不正です",
    ),
  theme: themeSchema,
});

export type SettingsFormState = {
  message: string | null;
  error: string | null;
};

export async function saveSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const parsed = settingsInputSchema.safeParse({
    session_size: formData.get("session_size"),
    theme: formData.get("theme"),
  });
  if (!parsed.success) return { message: null, error: "入力が不正です" };
  const { user, repos } = await requireUser();
  await repos.learning.saveSettings(user.id, parsed.data);
  const store = await cookies();
  store.set(THEME_COOKIE, parsed.data.theme, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { message: "保存しました", error: null };
}

export async function deleteAccountAction(): Promise<void> {
  const { user, repos } = await requireUser();
  await repos.learning.deleteAccount(user.id);
  await repos.auth.signOut();
  redirect("/login");
}

const goalInputSchema = z.object({
  goal: learningGoalSchema,
  subjectId: subjectIdSchema.nullable(),
});

/** ホームの学習目的の切り替え。題材は公開済みのものだけ受け付ける */
export async function setLearningGoalAction(formData: FormData): Promise<void> {
  const parsed = goalInputSchema.safeParse({
    goal: formData.get("goal"),
    subjectId: formData.get("subjectId") || null,
  });
  if (!parsed.success) return;
  const { user, repos } = await requireUser();
  const { goal, subjectId } = parsed.data;
  const current = await repos.learning.getSettings(user.id);
  const nextSubject = subjectId ?? current.focus_subject_id;
  const subject = nextSubject
    ? await repos.content.getSubject(nextSubject)
    : null;
  await repos.learning.saveSettings(user.id, {
    learning_goal: goal,
    focus_subject_id: subject?.id ?? null,
  });
  revalidatePath("/");
}
