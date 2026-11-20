/**
 * デイリーセッションの生成(純粋関数)。
 *
 * 方針(デイリーセッションと間隔反復):
 * - 期限切れ(due)の復習カードを最優先。期限が古いものから
 * - 残り枠を未学習カードで埋める。頻度順位(frequency_rank)が小さいものから
 * - 枚数は設定値(8〜20)。約 20 秒/枚で 3〜7 分に収まる
 * - 同順位の並びは id で固定し、同じ入力から常に同じ出力を返す(決定論)
 *
 * dedupeTerms(題材横断のベースコース):
 * - 同じ語句は 1 セッションに 1 回だけ出す
 * - 未学習の語句 > 複数の題材に出る語句 > 頻度順 の優先で網羅する
 * - 慣用句は頻出単語・表現パターンの後に回す
 */
import type { Card, Layer } from "@/shared/content/schema";
import { normalizeTerm } from "@/shared/content/terms";
import { isDue, type SrsState } from "@/features/srs/scheduler";

export const SECONDS_PER_CARD = 20;

export type SessionFilter = {
  subjectId: string | null;
  /** null は全層 */
  layers: readonly Layer[] | null;
  dedupeTerms?: boolean;
};

export type SessionPlan = {
  cards: Card[];
  dueCount: number;
  newCount: number;
  estimatedMinutes: number;
};

export type BuildSessionInput = {
  /** 公開済みカード(題材横断) */
  cards: readonly Card[];
  /** ユーザーの SRS 状態(card_id → state)。無いカードは未学習 */
  states: ReadonlyMap<string, SrsState>;
  filter: SessionFilter;
  size: number;
  now: Date;
};

export function matchesFilter(card: Card, filter: SessionFilter): boolean {
  if (filter.subjectId !== null && card.subject_id !== filter.subjectId)
    return false;
  if (filter.layers !== null && !filter.layers.includes(card.layer))
    return false;
  return true;
}

function byId(a: Card, b: Card): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function estimateMinutes(cardCount: number): number {
  return Math.max(1, Math.round((cardCount * SECONDS_PER_CARD) / 60));
}

function byFrequency(a: Card, b: Card): number {
  return (
    a.frequency_rank - b.frequency_rank ||
    a.subject_id.localeCompare(b.subject_id) ||
    byId(a, b)
  );
}

/** 題材横断の優先順: 未学習の語句 → 頻出単語・表現パターン → 多くの題材に出る語句 → 頻度順 */
function crossSubjectOrder(
  candidates: readonly Card[],
  states: ReadonlyMap<string, SrsState>,
): (a: Card, b: Card) => number {
  const subjects = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const card of candidates) {
    const term = normalizeTerm(card.target);
    if (!subjects.has(term)) subjects.set(term, new Set());
    subjects.get(term)?.add(card.subject_id);
    const state = states.get(card.id);
    if (state && state.state !== "new") seen.add(term);
  }
  const seenRank = (c: Card) => (seen.has(normalizeTerm(c.target)) ? 1 : 0);
  const tier = (c: Card) => (c.layer === "idiom" ? 1 : 0);
  const spread = (c: Card) => subjects.get(normalizeTerm(c.target))?.size ?? 0;
  return (a, b) =>
    seenRank(a) - seenRank(b) ||
    tier(a) - tier(b) ||
    spread(b) - spread(a) ||
    byFrequency(a, b);
}

export function buildSession(input: BuildSessionInput): SessionPlan {
  const { cards, states, filter, size, now } = input;
  const dedupe = filter.dedupeTerms === true;
  const candidates = cards.filter((c) => matchesFilter(c, filter));

  const due: { card: Card; dueAt: number }[] = [];
  const fresh: Card[] = [];
  for (const card of candidates) {
    const state = states.get(card.id);
    if (state === undefined || state.state === "new") {
      fresh.push(card);
    } else if (isDue(state, now)) {
      due.push({ card, dueAt: new Date(state.due_at).getTime() });
    }
  }

  due.sort((a, b) => a.dueAt - b.dueAt || byId(a.card, b.card));
  fresh.sort(dedupe ? crossSubjectOrder(candidates, states) : byFrequency);

  const picked: Card[] = [];
  const terms = new Set<string>();
  const take = (card: Card): boolean => {
    if (picked.length >= size) return false;
    const term = normalizeTerm(card.target);
    if (dedupe && terms.has(term)) return false;
    terms.add(term);
    picked.push(card);
    return true;
  };

  let dueCount = 0;
  for (const d of due) if (take(d.card)) dueCount += 1;
  for (const card of fresh) take(card);

  return {
    cards: picked,
    dueCount,
    newCount: picked.length - dueCount,
    estimatedMinutes: estimateMinutes(picked.length),
  };
}
