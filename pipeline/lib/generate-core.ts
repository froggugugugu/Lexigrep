/**
 * Claude によるカード生成の純粋ロジック(プロンプト構築・応答検証・コーパス照合・カード組み立て)。
 * API 呼び出し自体は pipeline/generate.ts が行う。
 */
import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  LAYERS,
  QUESTION_TYPES,
  cardSchema,
  layerSchema,
  questionTypeSchema,
  type Card,
  type Subject,
} from "../../src/shared/content/schema";
import { normalizeForMatch, type PageText } from "./text";
import type { TermEntry } from "./work";

export const generatedCardSchema = z.object({
  layer: layerSchema,
  target: z.string().min(1).max(120),
  sentence: z.string().min(1).max(400),
  source_url: z.url(),
  meaning_ja: z.string().min(1).max(200),
  note_ja: z.string().max(600).nullable(),
  question_type: questionTypeSchema,
  prompt_ja: z.string().max(200).nullable(),
  options: z.array(z.string().min(1).max(300)).min(2).max(6),
  answer: z.number().int().min(0),
  frequency_rank: z.number().int().min(1),
});
export type GeneratedCard = z.infer<typeof generatedCardSchema>;

export const generatedBatchSchema = z.object({
  cards: z.array(generatedCardSchema),
});

/** Claude の tool use に渡す JSON Schema */
export const CARD_TOOL: Anthropic.Messages.Tool = {
  name: "submit_cards",
  description: "生成した学習カードを提出する",
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            layer: { type: "string", enum: [...LAYERS] },
            target: {
              type: "string",
              description: "sentence の中に文字通り含まれる学習対象の語句",
            },
            sentence: {
              type: "string",
              description:
                "提供された実文からそのまま(一字一句変えずに)引用した 1 文",
            },
            source_url: {
              type: "string",
              description: "その実文が載っているページの URL(提供されたもの)",
            },
            meaning_ja: {
              type: "string",
              description: "日本語の意味(訳語)。200 字以内",
            },
            note_ja: {
              type: ["string", "null"],
              description: "1 文の補足(ニュアンス・使われる場面)",
            },
            question_type: { type: "string", enum: [...QUESTION_TYPES] },
            prompt_ja: {
              type: ["string", "null"],
              description: "設問文の上書き(next_action では必須)",
            },
            options: {
              type: "array",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            answer: {
              type: "integer",
              description: "options の中の正解インデックス(0 始まり)",
            },
            frequency_rank: {
              type: "integer",
              description: "指示された順位をそのまま入れる",
            },
          },
          required: [
            "layer",
            "target",
            "sentence",
            "source_url",
            "meaning_ja",
            "note_ja",
            "question_type",
            "prompt_ja",
            "options",
            "answer",
            "frequency_rank",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["cards"],
    additionalProperties: false,
  },
};

export function buildSystemPrompt(subject: Subject): string {
  return [
    "あなたは Lexigrep(日本語圏の IT エンジニアが英語の公式ドキュメントを翻訳なしで読めるようになるための学習アプリ)のカード作成者です。",
    `題材: ${subject.name}(${subject.description_ja})`,
    "",
    "各カードは「実文の中で語句を認識できるようになる」ための 1 パターンです。次を厳守してください:",
    "- sentence は提供された実文から一字一句そのまま引用する(言い換え・省略・結合は禁止)。提供されていない文は使わない",
    "- target は sentence に文字通り含まれる語句(大文字小文字も一致)",
    "- layer: vocab=題材横断の一般技術語 / pattern=ドキュメント特有の文型 / idiom=UI・警告の決まり文句 / system_term=題材固有の概念語",
    "- question_type と options: choose_meaning=日本語の意味 4 つ / fill_blank=空欄に入る英語の語句 4 つ / recognize_pattern=英文 4 つ(正解は同じパターンの別文) / next_action=日本語の次の行動 4 つ(prompt_ja に設問文)",
    "- 誤答は「読めていないと間違える」もっともらしさを持たせる。options は重複させない",
    "- meaning_ja は簡潔な訳語、note_ja は 1 文の補足。英語の技術用語は原語のままでよい",
    "- frequency_rank は指示された順位をそのまま使う",
    "- 1 つの語句につき 1 枚。指示された語句ごとに必ず 1 枚作る(作れない場合はその語句を省く)",
    "結果は submit_cards ツールで提出してください。",
  ].join("\n");
}

export function buildUserPrompt(
  targets: readonly TermEntry[],
  rankOffset: number,
): string {
  const lines: string[] = [
    "次の語句について、それぞれ 1 枚ずつカードを作ってください。実文は下に示したものだけを使ってください。",
    "",
  ];
  targets.forEach((t, i) => {
    lines.push(
      `### ${i + 1}. "${t.term}"  (frequency_rank: ${rankOffset + i + 1}, 出現文数: ${t.df})`,
    );
    for (const ex of t.examples) {
      lines.push(`- 実文: ${ex.sentence}`);
      lines.push(`  URL: ${ex.url}`);
    }
    lines.push("");
  });
  return lines.join("\n");
}

export type VerifyResult =
  | {
      ok: true;
      page: PageText;
      sentence: string;
      highlight: { start: number; end: number };
    }
  | { ok: false; reason: string };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** target を語境界つきで探す(例: "use" が "because" に当たらない)。見つからなければ -1 */
export function findTargetIndex(sentence: string, target: string): number {
  const re = new RegExp(
    `(?<![A-Za-z0-9])${escapeRegExp(target)}(?![A-Za-z0-9])`,
  );
  const m = re.exec(sentence);
  return m ? m.index : -1;
}

/**
 * 生成カードの実文がクロール済みコーパスに存在し、target が sentence に含まれることを確認する。
 * 保存する実文は LLM の出力ではなく、一致したコーパス側の原文にする(一字一句の引用を保証)。
 */
export function verifyGenerated(
  card: GeneratedCard,
  pages: readonly PageText[],
): VerifyResult {
  if (card.answer >= card.options.length)
    return { ok: false, reason: "answer が options の範囲外" };
  if (new Set(card.options).size !== card.options.length)
    return { ok: false, reason: "options が重複" };
  const needle = normalizeForMatch(card.sentence);
  const preferred = pages.find((p) => p.url === card.source_url);
  const candidates = preferred
    ? [preferred, ...pages.filter((p) => p !== preferred)]
    : pages;
  for (const page of candidates) {
    const original =
      page.sentences.find((s) => normalizeForMatch(s) === needle) ??
      page.sentences.find((s) => normalizeForMatch(s).includes(needle));
    if (!original) continue;
    const start = findTargetIndex(original, card.target);
    if (start < 0)
      return {
        ok: false,
        reason: `target "${card.target}" がコーパスの原文に語として含まれない`,
      };
    return {
      ok: true,
      page,
      sentence: original,
      highlight: { start, end: start + card.target.length },
    };
  }
  return { ok: false, reason: "sentence がクロール済みの実文に存在しない" };
}

export function assembleCard(
  card: GeneratedCard,
  subjectId: string,
  verified: {
    page: PageText;
    sentence: string;
    highlight: { start: number; end: number };
  },
  generator: string,
  now: Date,
  /** 頻度表の順位(コードで決める。LLM の出力は使わない) */
  frequencyRank: number = card.frequency_rank,
): Card {
  const iso = now.toISOString();
  const { page, sentence, highlight } = verified;
  return cardSchema.parse({
    id: randomUUID(),
    subject_id: subjectId,
    layer: card.layer,
    target: card.target,
    sentence,
    highlight,
    meaning_ja: card.meaning_ja,
    note_ja: card.note_ja,
    question_type: card.question_type,
    prompt_ja: card.prompt_ja,
    choices: { options: card.options, answer: card.answer },
    frequency_rank: frequencyRank,
    related_card_ids: [],
    generated_by: generator,
    reviewed_by: null,
    status: "draft",
    sources: [
      {
        url: page.url,
        title: page.title,
        fetched_at: page.fetched_at,
        attribution: null,
      },
    ],
    created_at: iso,
    updated_at: iso,
  });
}

export function cardKey(
  c: Pick<Card, "layer" | "target" | "sentence">,
): string {
  return `${c.layer}\u0000${c.target.toLowerCase()}\u0000${normalizeForMatch(c.sentence)}`;
}

/** 既存カードと統合(同じ層・語句・実文は追加しない) */
export function mergeCards(
  existing: readonly Card[],
  incoming: readonly Card[],
): { cards: Card[]; added: number; skipped: number } {
  const keys = new Set(existing.map(cardKey));
  const targets = new Set(existing.map((c) => c.target.toLowerCase()));
  const out = [...existing];
  let added = 0;
  let skipped = 0;
  for (const c of incoming) {
    const k = cardKey(c);
    if (keys.has(k) || targets.has(c.target.toLowerCase())) {
      skipped += 1;
      continue;
    }
    keys.add(k);
    targets.add(c.target.toLowerCase());
    out.push(c);
    added += 1;
  }
  return { cards: out, added, skipped };
}

/** 既存カードで既に扱っている語句を除いた生成対象を選ぶ */
export function selectTargets(
  terms: readonly TermEntry[],
  existing: readonly Card[],
  limit: number,
): TermEntry[] {
  const covered = new Set(existing.map((c) => c.target.toLowerCase()));
  return terms
    .filter((t) => !covered.has(t.term.toLowerCase()) && t.examples.length > 0)
    .slice(0, limit);
}

/** 生成カードがどの対象語句に対応するかを決め、頻度表の順位を返す(対応が無ければ null) */
export function rankForGenerated(
  card: GeneratedCard,
  batch: readonly TermEntry[],
  rankOffset: number,
): number | null {
  const t = card.target.toLowerCase();
  const idx = batch.findIndex(
    (b) =>
      t === b.term.toLowerCase() ||
      t.includes(b.term.toLowerCase()) ||
      b.term.toLowerCase().includes(t),
  );
  return idx < 0 ? null : rankOffset + idx + 1;
}
