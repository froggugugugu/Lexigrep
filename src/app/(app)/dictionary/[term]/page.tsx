import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeTerm } from "@/shared/content/terms";
import { requireUser } from "@/features/auth/require-user";
import { srsLabel } from "@/features/dashboard/queries";
import { Badge } from "@/shared/ui/Badge";
import { HighlightedSentence } from "@/shared/ui/HighlightedSentence";
import { Surface } from "@/shared/ui/Surface";
import { LAYER_LABELS } from "@/shared/ui/labels";

type Params = { term: string };

function decodeTerm(raw: string): string {
  try {
    return normalizeTerm(decodeURIComponent(raw));
  } catch {
    return normalizeTerm(raw);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  return { title: decodeTerm((await params).term) };
}

export const dynamic = "force-dynamic";

export default async function DictionaryEntryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const key = decodeTerm((await params).term);
  const { user, repos } = await requireUser();
  const [allCards, subjects] = await Promise.all([
    repos.content.listCards(),
    repos.content.listSubjects(),
  ]);
  const cards = allCards
    .filter((c) => normalizeTerm(c.target) === key)
    .sort((a, b) => a.frequency_rank - b.frequency_rank);
  const first = cards[0];
  if (!first) notFound();

  const states = await repos.learning.getReviewStates(
    user.id,
    cards.map((c) => c.id),
  );
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const meanings = [...new Set(cards.map((c) => c.meaning_ja))];

  return (
    <div className="space-y-5">
      <nav className="text-sm">
        <Link
          href="/dictionary"
          className="inline-flex min-h-tap items-center text-muted hover:text-foreground"
        >
          ← 辞書
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold wrap-break-word">
          {first.target}
        </h1>
        <ul className="mt-2 space-y-1">
          {meanings.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </header>

      <section className="space-y-3" data-testid="dictionary-examples">
        <h2 className="text-sm font-medium">実文({cards.length})</h2>
        {cards.map((card) => (
          <Surface key={card.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-1">
              <Badge>
                {subjectName.get(card.subject_id) ?? card.subject_id}
              </Badge>
              <Badge tone="accent">{LAYER_LABELS[card.layer]}</Badge>
              <Badge>{srsLabel(states.get(card.id))}</Badge>
            </div>
            <HighlightedSentence
              sentence={card.sentence}
              highlight={card.highlight}
            />
            {card.note_ja ? (
              <p className="text-sm text-muted">{card.note_ja}</p>
            ) : null}
            <div className="flex items-center justify-between text-xs">
              {card.sources[0] ? (
                <a
                  href={card.sources[0].url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-muted underline decoration-dotted underline-offset-2"
                >
                  出典: {card.sources[0].title}
                </a>
              ) : (
                <span />
              )}
              <Link
                href={`/cards/${card.id}`}
                className="inline-flex min-h-tap shrink-0 items-center pl-3 text-accent"
              >
                カード詳細
              </Link>
            </div>
          </Surface>
        ))}
      </section>
    </div>
  );
}
