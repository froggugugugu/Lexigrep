import type { Metadata } from "next";
import { requireUser } from "@/features/auth/require-user";
import { resolveSessionFilter } from "@/features/session/course";
import { prepareSession } from "@/features/session/queries";
import { SessionRunner } from "@/features/session/SessionRunner";
import { BottomNav } from "@/shared/ui/BottomNav";
import { LAYER_LABELS } from "@/shared/ui/labels";
import { siteConfig } from "@/shared/site/config";

export const metadata: Metadata = { title: "学習セッション" };
export const dynamic = "force-dynamic";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; subject?: string; layer?: string }>;
}) {
  const { user, repos } = await requireUser();
  const settings = await repos.learning.getSettings(user.id);
  const filter = resolveSessionFilter(await searchParams, settings);
  const payload = await prepareSession(
    repos,
    user.id,
    filter,
    settings.session_size,
    new Date(),
  );
  const subject = filter.subjectId
    ? await repos.content.getSubject(filter.subjectId)
    : null;
  const layerLabel =
    filter.layers?.length === 1 && filter.layers[0]
      ? LAYER_LABELS[filter.layers[0]]
      : null;
  const courseLabel =
    subject?.name ??
    (filter.dedupeTerms ? siteConfig.baseCourse.shortName : "全題材");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <p className="mb-2 text-xs text-muted" data-testid="session-course">
        {courseLabel}
        {layerLabel ? ` / ${layerLabel}` : ""}
      </p>
      {/* 開始時刻を key にしない(完了時の再検証で作り直されて完了画面が消える) */}
      <SessionRunner
        key={`${filter.subjectId ?? "all"}:${filter.layers?.join(",") ?? "all"}`}
        cards={payload.cards}
        startedAt={payload.startedAt}
        filter={payload.filter}
      />
      <BottomNav />
    </main>
  );
}
