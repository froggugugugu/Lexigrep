import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/features/auth/require-user";
import { computeSubjectProgress } from "@/features/dashboard/stats";
import { Badge } from "@/shared/ui/Badge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { Surface } from "@/shared/ui/Surface";
import { categoryLabel } from "@/shared/ui/labels";

export const metadata: Metadata = { title: "題材" };
export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const { user, repos } = await requireUser();
  const [subjects, cards, states] = await Promise.all([
    repos.content.listSubjects(),
    repos.content.listCards(),
    repos.learning.getReviewStates(user.id),
  ]);
  const progress = new Map(
    computeSubjectProgress(cards, states, new Date()).map((p) => [
      p.subjectId,
      p,
    ]),
  );

  return (
    <div>
      <PageHeader
        title="題材"
        description="学びたい題材を選ぶと、層ごとの進捗と未学習数が見られます"
      />
      {subjects.length === 0 ? (
        <EmptyState title="題材がまだありません" />
      ) : (
        <ul className="space-y-2" data-testid="subject-list">
          {subjects.map((s) => {
            const p = progress.get(s.id);
            return (
              <li key={s.id}>
                <Link href={`/subjects/${s.id}`} className="block">
                  <Surface className="transition-colors hover:bg-surface-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      <Badge>{categoryLabel(s)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {s.description_ja}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <span>
                        定着 {p?.mastered ?? 0} / 学習済 {p?.learned ?? 0} / 全{" "}
                        {p?.total ?? 0}
                      </span>
                      <span>未学習 {(p?.total ?? 0) - (p?.learned ?? 0)}</span>
                    </div>
                    <ProgressBar
                      value={p?.masteryRate ?? 0}
                      label={`${s.name} の定着率`}
                      className="mt-2"
                    />
                  </Surface>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
