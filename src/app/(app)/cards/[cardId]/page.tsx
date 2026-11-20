import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/require-user";
import { ReportForm } from "@/features/cards/ReportForm";
import { srsLabel } from "@/features/dashboard/queries";
import { Badge } from "@/shared/ui/Badge";
import { HighlightedSentence } from "@/shared/ui/HighlightedSentence";
import { Surface } from "@/shared/ui/Surface";
import { LAYER_LABELS, QUESTION_PROMPTS } from "@/shared/ui/labels";
import { normalizeTerm } from "@/shared/content/terms";

type Params = { cardId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { cardId } = await params;
  const { repos } = await requireUser();
  const card = await repos.content.getCard(cardId);
  return { title: card ? card.target : "カード" };
}

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function CardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { cardId } = await params;
  const { user, repos } = await requireUser();
  const card = await repos.content.getCard(cardId);
  if (!card) notFound();

  const [subject, states, related] = await Promise.all([
    repos.content.getSubject(card.subject_id),
    repos.learning.getReviewStates(user.id, [card.id]),
    repos.content.getCards(card.related_card_ids),
  ]);
  const state = states.get(card.id);

  return (
    <div className="space-y-5">
      <nav className="text-sm">
        <Link
          href={`/subjects/${card.subject_id}`}
          className="text-muted hover:text-foreground"
        >
          ← {subject?.name ?? card.subject_id}
        </Link>
      </nav>

      <header>
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <Badge>{card.subject_id}</Badge>
          <Badge tone="accent">{LAYER_LABELS[card.layer]}</Badge>
          <Badge tone={srsLabel(state) === "定着" ? "success" : "neutral"}>
            {srsLabel(state)}
          </Badge>
          {card.status !== "published" ? (
            <Badge tone="warning">{card.status}</Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold wrap-break-word">
          {card.target}
        </h1>
        <p className="mt-1 text-lg">{card.meaning_ja}</p>
        {card.note_ja ? (
          <p className="mt-2 text-sm text-muted">{card.note_ja}</p>
        ) : null}
        <Link
          href={`/dictionary/${encodeURIComponent(normalizeTerm(card.target))}`}
          className="mt-2 inline-flex min-h-tap items-center text-sm text-accent"
        >
          辞書で他の実文を見る
        </Link>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium">実文</h2>
        <HighlightedSentence
          sentence={card.sentence}
          highlight={card.highlight}
        />
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {card.sources.map((s) => (
            <li key={s.url}>
              出典:{" "}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2"
              >
                {s.title}
              </a>
              (取得: {s.fetched_at.slice(0, 10)})
              {s.attribution ? ` — ${s.attribution}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">設問</h2>
        <Surface className="text-sm">
          <p className="font-medium">
            {card.prompt_ja ?? QUESTION_PROMPTS[card.question_type]}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {card.choices.options.map((o, i) => (
              <li
                key={o}
                className={
                  i === card.choices.answer ? "text-success" : "text-muted"
                }
              >
                {o}
                {i === card.choices.answer ? " ✓" : ""}
              </li>
            ))}
          </ol>
        </Surface>
      </section>

      {state && state.state !== "new" ? (
        <section>
          <h2 className="mb-2 text-sm font-medium">学習状態</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Surface className="p-3">
              <dt className="text-xs text-muted">次回</dt>
              <dd className="mt-1 tabular-nums">{formatDate(state.due_at)}</dd>
            </Surface>
            <Surface className="p-3">
              <dt className="text-xs text-muted">復習回数 / 忘却</dt>
              <dd className="mt-1 tabular-nums">
                {state.reps} / {state.lapses}
              </dd>
            </Surface>
          </dl>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium">関連パターン</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/cards/${r.id}`}
                  className="flex min-h-tap items-center justify-between px-3 py-2 hover:bg-surface-2"
                >
                  <span className="text-sm">{r.target}</span>
                  <span className="text-xs text-muted">{r.meaning_ja}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <ReportForm cardId={card.id} />
      </section>
    </div>
  );
}
