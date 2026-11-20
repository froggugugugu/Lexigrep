/**
 * レビュー操作(純粋関数)。CLI(pipeline/review.ts)から使う。
 */
import { cardSchema, type Card } from "../../src/shared/content/schema";

export type Decision = "approve" | "reject" | "edit";

export function applyDecision(
  card: Card,
  decision: Decision,
  reviewer: string,
  now: Date,
  edited?: unknown,
): Card {
  const updated_at = now.toISOString();
  switch (decision) {
    case "approve":
      // 公開済みを承認し直しても降格させない
      return {
        ...card,
        status: card.status === "published" ? "published" : "reviewed",
        reviewed_by: reviewer,
        updated_at,
      };
    case "reject":
      return { ...card, status: "retired", reviewed_by: reviewer, updated_at };
    case "edit": {
      const parsed = cardSchema.parse(edited);
      if (parsed.id !== card.id) throw new Error("id は変更できません");
      return {
        ...parsed,
        status: "reviewed",
        reviewed_by: reviewer,
        updated_at,
      };
    }
  }
}

/** reviewed → published(投入前の最終ステップ) */
export function publishReviewed(
  cards: readonly Card[],
  now: Date,
): { cards: Card[]; count: number } {
  let count = 0;
  const updated_at = now.toISOString();
  const out = cards.map((c) => {
    if (c.status !== "reviewed") return c;
    count += 1;
    return { ...c, status: "published" as const, updated_at };
  });
  return { cards: out, count };
}

export function summarize(
  cards: readonly Card[],
): Record<Card["status"], number> {
  const s: Record<Card["status"], number> = {
    draft: 0,
    reviewed: 0,
    published: 0,
    retired: 0,
  };
  for (const c of cards) s[c.status] += 1;
  return s;
}

export function renderCard(card: Card, index: number, total: number): string {
  const { sentence, highlight } = card;
  const marked =
    sentence.slice(0, highlight.start) +
    "«" +
    sentence.slice(highlight.start, highlight.end) +
    "»" +
    sentence.slice(highlight.end);
  const choices = card.choices.options
    .map((o, i) => `   ${i === card.choices.answer ? "✔" : " "} ${i + 1}. ${o}`)
    .join("\n");
  return [
    `── [${index + 1}/${total}] ${card.subject_id} / ${card.layer} / ${card.question_type} / rank ${card.frequency_rank} / ${card.status}`,
    `   ${marked}`,
    `   target : ${card.target}`,
    `   meaning: ${card.meaning_ja}`,
    card.note_ja ? `   note   : ${card.note_ja}` : null,
    card.prompt_ja ? `   prompt : ${card.prompt_ja}` : null,
    choices,
    `   source : ${card.sources.map((s) => s.url).join(", ")}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
