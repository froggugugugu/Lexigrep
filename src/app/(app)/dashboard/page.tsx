import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireUser } from "@/features/auth/require-user";
import { loadOverview } from "@/features/dashboard/queries";
import { parseTimeZone, TZ_COOKIE } from "@/features/settings/theme";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Surface } from "@/shared/ui/Surface";
import { LAYER_LABELS } from "@/shared/ui/labels";

export const metadata: Metadata = { title: "記録" };
export const dynamic = "force-dynamic";

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export default async function DashboardPage() {
  const { user, repos } = await requireUser();
  const timeZone = parseTimeZone((await cookies()).get(TZ_COOKIE)?.value);
  const ov = await loadOverview(repos, user.id, timeZone, new Date());
  const subjectName = new Map(ov.subjects.map((s) => [s.id, s.name]));
  const maxCards = Math.max(1, ...ov.activity.map((a) => a.cards));
  const recent = ov.logs.slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader title="記録" description={`今日: ${ov.today}(${timeZone})`} />

      <dl className="grid grid-cols-2 gap-2">
        <Stat
          label="連続学習"
          value={`${ov.streak} 日`}
          testId="dashboard-streak"
        />
        <Stat label="正答率(30日)" value={pct(ov.accuracy30d)} />
        <Stat
          label="定着カード"
          value={`${ov.totals.mastered} / ${ov.totals.cards}`}
          testId="dashboard-mastered"
        />
        <Stat
          label="学習済カード"
          value={`${ov.totals.learned} / ${ov.totals.cards}`}
          testId="dashboard-learned"
        />
      </dl>

      <section>
        <h2 className="mb-2 text-sm font-medium">直近 14 日の学習量</h2>
        <Surface className="p-3">
          <ol
            className="flex h-24 items-end gap-1"
            aria-label="日別の学習カード数"
          >
            {ov.activity.map((a) => (
              <li
                key={a.date}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${a.date}: ${a.cards} 枚`}
              >
                <div
                  className={`w-full rounded-t ${a.cards > 0 ? "bg-accent" : "bg-surface-2"}`}
                  style={{
                    height: `${Math.max(4, (a.cards / maxCards) * 80)}px`,
                  }}
                  aria-label={`${a.date} ${a.cards} 枚`}
                />
                <span className="text-[9px] text-muted tabular-nums">
                  {a.date.slice(8, 10)}
                </span>
              </li>
            ))}
          </ol>
        </Surface>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">題材別</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-normal">題材</th>
              <th className="py-1 text-right font-normal">定着</th>
              <th className="py-1 text-right font-normal">学習済</th>
              <th className="py-1 text-right font-normal">復習待ち</th>
            </tr>
          </thead>
          <tbody>
            {ov.progress.map((p) => (
              <tr key={p.subjectId} className="border-t border-border">
                <td className="py-2">
                  {subjectName.get(p.subjectId) ?? p.subjectId}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {p.mastered}/{p.total}
                </td>
                <td className="py-2 text-right tabular-nums">{p.learned}</td>
                <td className="py-2 text-right tabular-nums">{p.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">最近のセッション</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            まだセッションの記録がありません。
          </p>
        ) : (
          <ul
            className="divide-y divide-border rounded-xl border border-border text-sm"
            data-testid="recent-sessions"
          >
            {recent.map((l) => {
              const correct = l.card_results.filter((r) => r.correct).length;
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="text-xs text-muted tabular-nums">
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone,
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(l.ended_at))}
                  </span>
                  <span className="text-xs text-muted">
                    {l.subject_id ?? "全題材"}
                    {l.layer ? ` / ${LAYER_LABELS[l.layer]}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {correct}/{l.card_results.length}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <Surface className="p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className="mt-1 text-xl font-semibold tabular-nums"
        data-testid={testId}
      >
        {value}
      </dd>
    </Surface>
  );
}
