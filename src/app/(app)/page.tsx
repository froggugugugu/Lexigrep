import { cookies } from "next/headers";
import Link from "next/link";
import type { Card, Layer, SrsState } from "@/shared/content/schema";
import { requireUser } from "@/features/auth/require-user";
import { loadOverview } from "@/features/dashboard/queries";
import { computeTermProgress } from "@/features/dashboard/stats";
import { BASE_LAYERS } from "@/features/session/course";
import { setLearningGoalAction } from "@/features/settings/actions";
import { parseTimeZone, TZ_COOKIE } from "@/features/settings/theme";
import { LinkButton } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { Surface } from "@/shared/ui/Surface";
import { cn } from "@/shared/ui/cn";
import { siteConfig } from "@/shared/site/config";
import { LAYER_LABELS } from "@/shared/ui/labels";

export const dynamic = "force-dynamic";

function progressRatio(p: { learned: number; total: number }): number {
  return p.total === 0 ? 0 : p.learned / p.total;
}

export default async function HomePage() {
  const { user, repos } = await requireUser();
  const timeZone = parseTimeZone((await cookies()).get(TZ_COOKIE)?.value);
  const ov = await loadOverview(repos, user.id, timeZone, new Date());
  const { learning_goal: goal, focus_subject_id: focusId } = ov.settings;
  const focus = ov.subjects.find((s) => s.id === focusId) ?? null;
  const subjectMode = goal === "subject";
  const needsSubject = subjectMode && !focus;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {user.displayName ? `${user.displayName} さん` : "ようこそ"}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted">連続学習</p>
          <p
            className="text-2xl font-semibold tabular-nums"
            data-testid="streak"
          >
            {ov.streak}
            <span className="ml-0.5 text-sm font-normal text-muted">日</span>
          </p>
        </div>
      </header>

      {ov.subjects.length === 0 ? (
        <EmptyState title="題材がまだありません">
          <p>
            学びたい英語サイトから学習カードを作ると、ここに題材が並びます。
          </p>
          <p className="mt-2">
            Claude Code で /author-subject に題材サイトの URL を渡すか、pnpm
            content:init で題材の雛形を作ってください。
          </p>
        </EmptyState>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="学習の目的"
          >
            <GoalButton
              goal="general"
              active={!subjectMode}
              title={siteConfig.baseCourse.goalTitle}
              hint="題材横断で網羅"
            />
            <GoalButton
              goal="subject"
              active={subjectMode}
              title="題材を絞る"
              hint="選んだ題材だけ"
            />
          </div>

          {needsSubject ? (
            <section>
              <h2 className="mb-2 text-sm font-medium">
                どの題材に集中しますか?
              </h2>
              <SubjectPicker subjects={ov.subjects} selected={null} />
            </section>
          ) : (
            <Surface className="border-accent/40" data-testid="today-session">
              <p className="text-sm text-muted">
                {focus && subjectMode
                  ? `${focus.name} のセッション`
                  : `${siteConfig.baseCourse.shortName}のセッション`}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {ov.plan.count} 枚{" "}
                <span className="text-sm font-normal text-muted">
                  / 約 {ov.plan.minutes} 分
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">
                復習 {ov.plan.due} 枚 ・ 新規 {ov.plan.fresh} 枚
              </p>
              <div className="mt-3">
                {ov.plan.count > 0 ? (
                  <LinkButton href="/session" size="lg" full>
                    セッションを始める
                  </LinkButton>
                ) : (
                  <p className="text-sm text-muted">
                    今日の分は完了です。下から別の層や題材を選べます。
                  </p>
                )}
              </div>
            </Surface>
          )}

          {subjectMode ? (
            focus ? (
              <>
                <section data-testid="focus-layers">
                  <h2 className="mb-2 text-sm font-medium">
                    {focus.name} の進捗
                  </h2>
                  <ul className="space-y-2">
                    {(
                      ["system_term", "vocab", "pattern", "idiom"] as const
                    ).map((layer) => (
                      <LayerRow
                        key={layer}
                        label={LAYER_LABELS[layer]}
                        href={`/session?subject=${encodeURIComponent(focus.id)}&layer=${layer}`}
                        progress={termProgress(
                          ov.cards,
                          ov.states,
                          layer,
                          focus.id,
                        )}
                      />
                    ))}
                  </ul>
                </section>
                <section>
                  <h2 className="mb-2 text-sm font-medium">題材を変える</h2>
                  <SubjectPicker subjects={ov.subjects} selected={focus.id} />
                </section>
              </>
            ) : null
          ) : (
            <>
              <section data-testid="base-layers">
                <h2 className="mb-2 text-sm font-medium">
                  ステップ 1: {siteConfig.baseCourse.stepTitle}
                </h2>
                <ul className="space-y-2">
                  {BASE_LAYERS.map((layer) => (
                    <LayerRow
                      key={layer}
                      label={LAYER_LABELS[layer]}
                      href={`/session?course=base&layer=${layer}`}
                      progress={termProgress(ov.cards, ov.states, layer, null)}
                    />
                  ))}
                </ul>
              </section>
              <section data-testid="subject-terms">
                <h2 className="mb-2 text-sm font-medium">
                  ステップ 2: 題材の特有語に慣れる
                </h2>
                <ul className="space-y-2">
                  {ov.subjects.map((s) => (
                    <LayerRow
                      key={s.id}
                      label={s.name}
                      href={`/session?subject=${encodeURIComponent(s.id)}&layer=system_term`}
                      progress={termProgress(
                        ov.cards,
                        ov.states,
                        "system_term",
                        s.id,
                      )}
                    />
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      {repos.source === "memory" ? (
        <p className="text-center text-[11px] text-muted">
          デモモード(データはサーバー再起動で消えます)
        </p>
      ) : repos.source === "local" ? (
        <p className="text-center text-[11px] text-muted">
          ローカル保存モード(学習データはこの PC に保存されます)
        </p>
      ) : null}
    </div>
  );
}

function termProgress(
  cards: readonly Card[],
  states: ReadonlyMap<string, SrsState>,
  layer: Layer,
  subjectId: string | null,
) {
  return computeTermProgress(
    cards.filter(
      (c) =>
        c.layer === layer && (subjectId === null || c.subject_id === subjectId),
    ),
    states,
  );
}

function GoalButton({
  goal,
  active,
  title,
  hint,
}: {
  goal: "general" | "subject";
  active: boolean;
  title: string;
  hint: string;
}) {
  return (
    <form action={setLearningGoalAction}>
      <input type="hidden" name="goal" value={goal} />
      <button
        type="submit"
        aria-pressed={active}
        data-testid={`goal-${goal}`}
        className={cn(
          "min-h-14 w-full rounded-lg border px-3 py-2 text-left",
          active ? "border-accent bg-accent/15" : "border-border bg-surface",
        )}
      >
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </button>
    </form>
  );
}

function SubjectPicker({
  subjects,
  selected,
}: {
  subjects: { id: string; name: string }[];
  selected: string | null;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="集中する題材"
    >
      {subjects.map((s) => (
        <form key={s.id} action={setLearningGoalAction}>
          <input type="hidden" name="goal" value="subject" />
          <input type="hidden" name="subjectId" value={s.id} />
          <button
            type="submit"
            aria-pressed={selected === s.id}
            data-testid={`focus-${s.id}`}
            className={cn(
              "min-h-tap rounded-full border px-4 text-sm",
              selected === s.id
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface",
            )}
          >
            {s.name}
          </button>
        </form>
      ))}
    </div>
  );
}

function LayerRow({
  label,
  href,
  progress,
}: {
  label: string;
  href: string;
  progress: { total: number; learned: number; mastered: number };
}) {
  return (
    <li>
      <Link href={href} className="block">
        <Surface className="p-3 transition-colors hover:bg-surface-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted tabular-nums">
              {progress.learned} / {progress.total} 語
            </span>
          </div>
          <ProgressBar
            value={progressRatio(progress)}
            label={`${label} の進捗`}
            className="mt-2"
          />
        </Surface>
      </Link>
    </li>
  );
}
