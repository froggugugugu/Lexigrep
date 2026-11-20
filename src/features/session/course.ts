/**
 * 学習コース(2 軸の UX)。
 * - ベースコース(`site.config.ts` の baseCourse): 題材横断で頻出単語・表現パターン・慣用句を網羅する
 * - 題材集中: 選んだ題材だけを学ぶ
 * URL の指定を優先し、無ければ保存済みの学習目的から決める(純粋関数)。
 */
import {
  layerSchema,
  type Layer,
  type UserSettings,
} from "@/shared/content/schema";
import type { SessionFilter } from "./build-session";

export const BASE_LAYERS: readonly Layer[] = ["vocab", "pattern", "idiom"];

export const BASE_FILTER: SessionFilter = {
  subjectId: null,
  layers: BASE_LAYERS,
  dedupeTerms: true,
};

export type SessionParams = {
  course?: string;
  subject?: string;
  layer?: string;
};

export function filterForGoal(
  settings: Pick<UserSettings, "learning_goal" | "focus_subject_id">,
): SessionFilter {
  if (settings.learning_goal === "subject" && settings.focus_subject_id) {
    return { subjectId: settings.focus_subject_id, layers: null };
  }
  return BASE_FILTER;
}

export function resolveSessionFilter(
  params: SessionParams,
  settings: Pick<UserSettings, "learning_goal" | "focus_subject_id">,
): SessionFilter {
  const parsed = layerSchema.safeParse(params.layer);
  const layer = parsed.success ? parsed.data : null;
  const subject = params.subject?.trim() ? params.subject.trim() : null;

  if (subject) return { subjectId: subject, layers: layer ? [layer] : null };
  if (params.course === "base")
    return { ...BASE_FILTER, layers: layer ? [layer] : BASE_LAYERS };
  if (layer) return { subjectId: null, layers: [layer], dedupeTerms: true };
  return filterForGoal(settings);
}

/** 学習ログには単一の層だけを記録する(複数層は null) */
export function loggedLayer(filter: SessionFilter): Layer | null {
  return filter.layers?.length === 1 ? (filter.layers[0] ?? null) : null;
}
