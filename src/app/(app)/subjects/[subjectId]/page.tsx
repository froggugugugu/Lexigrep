import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LAYERS, type Layer } from "@/shared/content/schema";
import { requireUser } from "@/features/auth/require-user";
import { srsLabel } from "@/features/dashboard/queries";
import { isDue } from "@/features/srs/scheduler";
import { Badge } from "@/shared/ui/Badge";
import { LinkButton } from "@/shared/ui/Button";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Surface } from "@/shared/ui/Surface";
import { categoryLabel, LAYER_LABELS } from "@/shared/ui/labels";

type Params = { subjectId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { subjectId } = await params;
  return { title: subjectId };
}

export const dynamic = "force-dynamic";

export default async function SubjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { subjectId } = await params;
  const { user, repos } = await requireUser();
  const subject = await repos.content.getSubject(subjectId);
  if (!subject) notFound();

  const now = new Date();
  const cards = await repos.content.listCards({ subjectId });
  const states = await repos.learning.getReviewStates(
    user.id,
    cards.map((c) => c.id),
  );

  const byLayer = new Map<Layer, typeof cards>();
  for (const layer of LAYERS) byLayer.set(layer, []);
  for (const c of cards) byLayer.get(c.layer)?.push(c);
  for (const list of byLayer.values())
    list.sort((a, b) => a.frequency_rank - b.frequency_rank);

  return (
    <div className="space-y-5">
      <PageHeader
        title={subject.name}
        description={subject.description_ja}
        action={<Badge>{categoryLabel(subject)}</Badge>}
      />

      <LinkButton
        href={`/session?subject=${encodeURIComponent(subject.id)}`}
        size="lg"
        full
      >
        この題材で学習する
      </LinkButton>

      <section className="space-y-2" data-testid="layer-list">
        <h2 className="text-sm font-medium">層ごとの進捗</h2>
        {LAYERS.map((layer) => {
          const list = byLayer.get(layer) ?? [];
          const learned = list.filter(
            (c) => (states.get(c.id)?.state ?? "new") !== "new",
          ).length;
          const due = list.filter((c) => {
            const s = states.get(c.id);
            return s && s.state !== "new" && isDue(s, now);
          }).length;
          return (
            <Surface
              key={layer}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div>
                <p className="font-medium">{LAYER_LABELS[layer]}</p>
                <p className="text-xs text-muted">
                  全 {list.length} / 学習済 {learned} / 未学習{" "}
                  {list.length - learned}
                  {due > 0 ? ` / 復習 ${due}` : ""}
                </p>
              </div>
              {list.length > 0 ? (
                <LinkButton
                  href={`/session?subject=${encodeURIComponent(subject.id)}&layer=${layer}`}
                  variant="secondary"
                >
                  学習
                </LinkButton>
              ) : null}
            </Surface>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">カード一覧(頻度順)</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted">
            公開済みのカードがまだありません。
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {LAYERS.flatMap((layer) =>
              (byLayer.get(layer) ?? []).map((c) => {
                const label = srsLabel(states.get(c.id));
                return (
                  <li key={c.id}>
                    <Link
                      href={`/cards/${c.id}`}
                      className="flex min-h-tap items-center justify-between gap-3 px-3 py-2 hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">
                          {c.target}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.meaning_ja}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge>{LAYER_LABELS[layer]}</Badge>
                        <Badge
                          tone={
                            label === "定着"
                              ? "success"
                              : label === "新規"
                                ? "neutral"
                                : "accent"
                          }
                        >
                          {label}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                );
              }),
            )}
          </ul>
        )}
      </section>

      <section className="text-xs text-muted">
        <p>出典サイト:</p>
        <ul className="mt-1 space-y-1">
          {subject.official_urls.map((u) => (
            <li key={u}>
              <a
                href={u}
                target="_blank"
                rel="noreferrer"
                className="break-all underline decoration-dotted underline-offset-2"
              >
                {u}
              </a>
            </li>
          ))}
        </ul>
        {subject.license_note ? (
          <p className="mt-2">{subject.license_note}</p>
        ) : null}
      </section>
    </div>
  );
}
