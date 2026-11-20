/**
 * 辞書の索引と検索(純粋関数)。カードを語句単位にまとめ、英語の語句と日本語の意味の両方で引く。
 */
import type { Card, Layer } from "@/shared/content/schema";
import { normalizeTerm } from "@/shared/content/terms";

export type DictionaryEntry = {
  key: string;
  term: string;
  meaning_ja: string;
  layers: Layer[];
  subjectIds: string[];
  cardCount: number;
};

export type DictionaryFilter = {
  layer: Layer | null;
  subjectId: string | null;
};

export function buildDictionary(cards: readonly Card[]): DictionaryEntry[] {
  const map = new Map<string, DictionaryEntry>();
  for (const card of [...cards].sort(
    (a, b) => a.frequency_rank - b.frequency_rank,
  )) {
    const key = normalizeTerm(card.target);
    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        key,
        term: card.target,
        meaning_ja: card.meaning_ja,
        layers: [card.layer],
        subjectIds: [card.subject_id],
        cardCount: 1,
      });
      continue;
    }
    entry.cardCount += 1;
    if (!entry.layers.includes(card.layer)) entry.layers.push(card.layer);
    if (!entry.subjectIds.includes(card.subject_id))
      entry.subjectIds.push(card.subject_id);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** 小さいほど良い一致。一致しなければ null */
function matchScore(entry: DictionaryEntry, query: string): number | null {
  if (entry.key === query) return 0;
  if (entry.key.startsWith(query)) return 1;
  if (entry.key.split(" ").some((word) => word.startsWith(query))) return 2;
  if (entry.key.includes(query)) return 3;
  if (entry.meaning_ja.toLowerCase().includes(query)) return 4;
  return null;
}

export function searchDictionary(
  entries: readonly DictionaryEntry[],
  rawQuery: string,
  filter: DictionaryFilter,
): DictionaryEntry[] {
  const query = normalizeTerm(rawQuery);
  const filtered = entries.filter(
    (e) =>
      (filter.layer === null || e.layers.includes(filter.layer)) &&
      (filter.subjectId === null || e.subjectIds.includes(filter.subjectId)),
  );
  if (query === "") return filtered;
  return filtered
    .flatMap((entry) => {
      const score = matchScore(entry, query);
      return score === null ? [] : [{ entry, score }];
    })
    .sort((a, b) => a.score - b.score || a.entry.key.localeCompare(b.entry.key))
    .map((x) => x.entry);
}
