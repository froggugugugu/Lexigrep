/**
 * クロール済みコーパスからカードを起こす「人手 / AI 執筆」支援(純粋ロジック)。
 * 執筆者は語句・意味・選択肢だけを書き、実文と出典はコーパスから機械的に選ぶ。
 * → 引用の正確さと出典 URL を構造的に保証する(実文に紐づく学習の原則)。
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  cardSchema,
  layerSchema,
  questionTypeSchema,
  type Card,
} from "../../src/shared/content/schema";
import { isProse, normalizeForMatch, type PageText } from "./text";

export const authorSpecSchema = z.object({
  layer: layerSchema,
  /** 実文中に文字通り含まれる学習対象 */
  target: z.string().min(1).max(120),
  /** 実文を探すための部分文字列(省略時は target)。大文字小文字・空白のゆれは無視 */
  match: z.string().min(1).optional(),
  /** 出典 URL に含まれていてほしい文字列(ページの優先指定) */
  url_hint: z.string().optional(),
  /** 候補の何番目を使うか(0 始まり)。同じ文が複数ページにある場合の調整用 */
  pick: z.number().int().min(0).default(0),
  meaning_ja: z.string().min(1).max(200),
  note_ja: z.string().max(600).nullable().default(null),
  question_type: questionTypeSchema,
  prompt_ja: z.string().max(200).nullable().default(null),
  options: z.array(z.string().min(1).max(300)).min(2).max(6),
  answer: z.number().int().min(0),
  rank: z.number().int().min(1),
  /** 同じファイル内の他カードを related として指す(target 文字列で参照) */
  related: z.array(z.string()).default([]),
});
export type AuthorSpec = z.infer<typeof authorSpecSchema>;

export const authorFileSchema = z.object({
  subject_id: z.string(),
  generated_by: z.string().min(1).max(80),
  specs: z.array(authorSpecSchema).min(1),
});
export type AuthorFile = z.infer<typeof authorFileSchema>;

const MAX_SENTENCE = 220;

/** UUID v5(名前ベース、決定論)— 再実行しても同じカード id になる */
export function uuidV5(
  name: string,
  namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(Buffer.concat([ns, Buffer.from(name, "utf8")]))
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type Candidate = { page: PageText; sentence: string; start: number };

/** target を文字通り含み、match も含む文を、短い順(url_hint 一致を優先)に列挙する */
export function findCandidates(
  spec: AuthorSpec,
  pages: readonly PageText[],
): Candidate[] {
  const needle = normalizeForMatch(spec.match ?? spec.target);
  const out: Candidate[] = [];
  for (const page of pages) {
    for (const sentence of page.sentences) {
      if (sentence.length > MAX_SENTENCE) continue;
      if (!normalizeForMatch(sentence).includes(needle)) continue;
      const start = sentence.indexOf(spec.target);
      if (start < 0) continue;
      out.push({ page, sentence, start });
    }
  }
  const hinted = (c: Candidate) =>
    spec.url_hint && c.page.url.includes(spec.url_hint) ? 0 : 1;
  const prose = (c: Candidate) => (isProse(c.sentence) ? 0 : 1);
  // 散文らしい文 > url_hint 一致 > 60〜150 字の範囲内(短すぎる文は文脈が無い) > 短い順 > URL 順
  const lengthScore = (c: Candidate) => {
    const n = c.sentence.length;
    if (n < 60) return 60 - n;
    if (n > 150) return n - 150;
    return 0;
  };
  return out.sort(
    (a, b) =>
      prose(a) - prose(b) ||
      hinted(a) - hinted(b) ||
      lengthScore(a) - lengthScore(b) ||
      a.sentence.length - b.sentence.length ||
      a.page.url.localeCompare(b.page.url),
  );
}

export type AuthorResult =
  { ok: true; card: Card } | { ok: false; target: string; reason: string };

export function authorCard(
  spec: AuthorSpec,
  subjectId: string,
  generatedBy: string,
  pages: readonly PageText[],
  now: Date,
): AuthorResult {
  const candidates = findCandidates(spec, pages);
  const chosen = candidates[spec.pick];
  if (!chosen) {
    return {
      ok: false,
      target: spec.target,
      reason:
        candidates.length === 0
          ? "実文が見つからない"
          : `候補が ${candidates.length} 件しかない(pick=${spec.pick})`,
    };
  }
  const iso = now.toISOString();
  const id = uuidV5(
    `lexigrep:${subjectId}:${spec.layer}:${spec.target}:${chosen.sentence}`,
  );
  const parsed = cardSchema.safeParse({
    id,
    subject_id: subjectId,
    layer: spec.layer,
    target: spec.target,
    sentence: chosen.sentence,
    highlight: { start: chosen.start, end: chosen.start + spec.target.length },
    meaning_ja: spec.meaning_ja,
    note_ja: spec.note_ja,
    question_type: spec.question_type,
    prompt_ja: spec.prompt_ja,
    choices: { options: spec.options, answer: spec.answer },
    frequency_rank: spec.rank,
    related_card_ids: [],
    generated_by: generatedBy,
    reviewed_by: null,
    status: "draft",
    sources: [
      {
        url: chosen.page.url,
        title: chosen.page.title,
        fetched_at: chosen.page.fetched_at,
        attribution: null,
      },
    ],
    created_at: iso,
    updated_at: iso,
  });
  if (!parsed.success) {
    return {
      ok: false,
      target: spec.target,
      reason: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, card: parsed.data };
}

/** related(target 文字列)を id に解決する */
export function linkRelated(
  cards: Card[],
  specs: readonly AuthorSpec[],
): Card[] {
  const byTarget = new Map(cards.map((c) => [c.target, c.id]));
  return cards.map((card) => {
    const spec = specs.find(
      (s) => s.target === card.target && s.layer === card.layer,
    );
    const ids = (spec?.related ?? [])
      .map((t) => byTarget.get(t))
      .filter((id): id is string => id !== undefined && id !== card.id);
    return { ...card, related_card_ids: [...new Set(ids)] };
  });
}
