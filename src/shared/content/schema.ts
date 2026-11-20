/**
 * 題材パッケージ(コンテンツ)スキーマ
 *
 * 原則: アプリは特定題材を知らない。題材はこのスキーマに従うデータとして投入される。
 * DB(supabase/migrations)・パイプライン(pipeline/)・投入スクリプト(scripts/)・
 * アプリ(src/)はすべてこのファイルを唯一の定義源(single source of truth)とする。
 *
 * 入力形式(content/<subject_id>/):
 *   subject.json   — Subject
 *   cards.jsonl    — 1 行 1 カード(Card + sources)
 *   manifest.json  — Manifest(version / card_count / checksum)
 */
import { z } from "zod";

// ── 共通 ─────────────────────────────────────────────────────────────

/** 題材 ID / 題材横断の共通語彙は `common` */
export const subjectIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug 形式(小文字英数とハイフン)");

/**
 * 題材のカテゴリ。題材の追加にデプロイが要らないよう、列挙ではなく slug 形式の自由な文字列にする
 * (DB の CHECK と一致)。画面の表示名は `category_label` → 既知の表示名 → 値そのもの の順で決める。
 */
export const subjectCategorySchema = z
  .string()
  .max(40)
  .regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/, "slug 形式(小文字英数と _ / -)");
export type SubjectCategory = z.infer<typeof subjectCategorySchema>;

/** 同梱題材で使っている既知のカテゴリ(表示名の既定値を持つ) */
export const KNOWN_SUBJECT_CATEGORIES = [
  "genai",
  "language_fw",
  "cloud",
  "idp",
  "testing",
] as const;

/** 学習層(固定 4 件) */
export const LAYERS = ["vocab", "pattern", "idiom", "system_term"] as const;
export const layerSchema = z.enum(LAYERS);
export type Layer = z.infer<typeof layerSchema>;

export const QUESTION_TYPES = [
  "choose_meaning",
  "fill_blank",
  "recognize_pattern",
  "next_action",
] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const CARD_STATUSES = [
  "draft",
  "reviewed",
  "published",
  "retired",
] as const;
export const cardStatusSchema = z.enum(CARD_STATUSES);
export type CardStatus = z.infer<typeof cardStatusSchema>;

const isoDateTime = z.iso.datetime({ offset: true });

/** 出典・公式サイトは http(s) に限定する(DB の CHECK と一致させ、a href に他スキームを出さない) */
const httpUrl = z.url().regex(/^https?:\/\//, "http(s) の URL");

/**
 * highlight の文字オフセットは JS(UTF-16)と PostgreSQL(コードポイント)で数え方が違う。
 * 補助平面文字(絵文字など)を含む実文は両者がずれるため、引用対象から外す。
 */
const noSurrogates = (s: string) => !/[\uD800-\uDFFF]/.test(s);

// ── Subject ───────────────────────────────────────────────────────────

export const subjectSchema = z.object({
  id: subjectIdSchema,
  name: z.string().min(1).max(80),
  category: subjectCategorySchema,
  /** カテゴリの表示名(任意)。未指定なら既知の表示名か値そのものを出す */
  category_label: z.string().trim().min(1).max(40).nullish(),
  /** 題材ブラウザに出す 1 行説明 */
  description_ja: z.string().min(1).max(200),
  /** クロール対象のルート URL */
  official_urls: z.array(httpUrl).min(1),
  /** 引用方針・帰属表示 */
  license_note: z.string().max(1000).default(""),
  /** パッケージのバージョン。再クロールで増える */
  version: z.number().int().min(1),
  crawled_at: isoDateTime.nullable(),
  is_published: z.boolean(),
});
export type Subject = z.infer<typeof subjectSchema>;

// ── Source(出典) ─────────────────────────────────────────────────────

export const sourceSchema = z.object({
  url: httpUrl,
  title: z.string().min(1).max(300),
  /** 取得日(陳腐化検知に使う) */
  fetched_at: isoDateTime,
  /** 表示すべき帰属文言(ライセンスに応じて)。不要なら null */
  attribution: z.string().max(500).nullable().default(null),
});
export type Source = z.infer<typeof sourceSchema>;

// ── Card ──────────────────────────────────────────────────────────────

/** sentence 内の target の位置(文字オフセット、end は排他的) */
export const highlightSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
});
export type Highlight = z.infer<typeof highlightSchema>;

/**
 * 選択肢。question_type に関わらず「選択肢の配列 + 正解のインデックス」に正規化する。
 * - choose_meaning     : options = 日本語の意味
 * - fill_blank         : options = 空欄に入る英語の語句
 * - recognize_pattern  : options = 英文(同じパターンの別文を選ぶ)
 * - next_action        : options = 日本語の「次の行動」
 */
export const choicesSchema = z
  .object({
    options: z.array(z.string().min(1).max(300)).min(2).max(6),
    answer: z.number().int().min(0),
  })
  .refine((c) => c.answer < c.options.length, {
    message: "answer は options の範囲内",
    path: ["answer"],
  })
  .refine((c) => new Set(c.options).size === c.options.length, {
    message: "options は重複不可",
    path: ["options"],
  });
export type Choices = z.infer<typeof choicesSchema>;

const cardBaseSchema = z.object({
  id: z.uuid(),
  subject_id: subjectIdSchema,
  layer: layerSchema,
  /** 学習対象の語句(例: `is not assignable to`) */
  target: z.string().min(1).max(120),
  /** 実文(文単位の短い引用。出典リンク必須) */
  sentence: z
    .string()
    .min(1)
    .max(400)
    .refine(noSurrogates, "補助平面文字(絵文字など)を含む実文は使えない"),
  highlight: highlightSchema,
  meaning_ja: z.string().min(1).max(200),
  /** 補足(訳語 + 1 文の補足) */
  note_ja: z.string().max(600).nullable().default(null),
  question_type: questionTypeSchema,
  /** 設問文を上書きしたいとき(省略時は question_type ごとの既定文) */
  prompt_ja: z.string().max(200).nullable().default(null),
  choices: choicesSchema,
  /** 題材内の頻度順位(出題順の基礎)。1 が最頻出 */
  frequency_rank: z.number().int().min(1),
  related_card_ids: z.array(z.uuid()).default([]),
  /** `claude-<model>` / `human` */
  generated_by: z.string().min(1).max(80),
  /** レビュー者。null なら未レビュー */
  reviewed_by: z.string().min(1).max(80).nullable().default(null),
  status: cardStatusSchema,
  sources: z.array(sourceSchema).min(1),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export const cardSchema = cardBaseSchema
  .refine((c) => c.highlight.end <= c.sentence.length, {
    message: "highlight.end は sentence の長さ以下",
    path: ["highlight", "end"],
  })
  .refine((c) => c.highlight.start < c.highlight.end, {
    message: "highlight.start < highlight.end",
    path: ["highlight"],
  })
  .refine(
    (c) =>
      c.highlight.end <= c.sentence.length &&
      c.sentence.slice(c.highlight.start, c.highlight.end) === c.target,
    {
      message: "sentence の highlight 範囲は target と一致すること",
      path: ["highlight"],
    },
  )
  .refine((c) => !c.related_card_ids.includes(c.id), {
    message: "related_card_ids に自分自身を含めない",
    path: ["related_card_ids"],
  })
  .refine((c) => c.status === "draft" || c.reviewed_by !== null, {
    message: "draft 以外は reviewed_by が必須",
    path: ["reviewed_by"],
  });
export type Card = z.infer<typeof cardSchema>;

/** 投入前(id / 日時を持たない)カード。パイプラインの生成出力に使う */
export const cardDraftInputSchema = cardBaseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  status: true,
  reviewed_by: true,
  related_card_ids: true,
});
export type CardDraftInput = z.infer<typeof cardDraftInputSchema>;

// ── Manifest ──────────────────────────────────────────────────────────

export const manifestSchema = z.object({
  subject_id: subjectIdSchema,
  version: z.number().int().min(1),
  crawled_at: isoDateTime.nullable(),
  card_count: z.number().int().min(0),
  /** cards.jsonl の SHA-256(hex) */
  checksum: z.string().regex(/^[0-9a-f]{64}$/, "sha256 hex"),
  generated_at: isoDateTime,
  /** 生成元(例: `pipeline@0.1.0` / `human`) */
  generator: z.string().min(1).max(80),
});
export type Manifest = z.infer<typeof manifestSchema>;

// ── 学習状態(ユーザー × カード) ─────────────────────────────────────

export const REVIEW_STATES = [
  "new",
  "learning",
  "review",
  "relearning",
] as const;
export const reviewStateNameSchema = z.enum(REVIEW_STATES);
export type ReviewStateName = z.infer<typeof reviewStateNameSchema>;

/** ユーザー・カードに依らない FSRS 状態部分 */
export const srsStateSchema = z.object({
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  due_at: isoDateTime,
  last_reviewed_at: isoDateTime.nullable(),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: reviewStateNameSchema,
  /** FSRS-7(ts-fsrs 6)の内部値: 短期安定度 / 予定間隔(日) / 学習ステップ */
  stability_fast: z.number().min(0),
  scheduled_days: z.number().min(0),
  learning_step: z.number().int().min(0),
});
export type SrsState = z.infer<typeof srsStateSchema>;

export const reviewStateSchema = srsStateSchema.extend({
  user_id: z.uuid(),
  card_id: z.uuid(),
});
export type ReviewState = z.infer<typeof reviewStateSchema>;

// ── 学習ログ ──────────────────────────────────────────────────────────

export const cardResultSchema = z.object({
  card_id: z.uuid(),
  correct: z.boolean(),
  elapsed_ms: z.number().int().min(0),
});
export type CardResult = z.infer<typeof cardResultSchema>;

export const sessionLogSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  started_at: isoDateTime,
  ended_at: isoDateTime,
  /** セッション開始時に選んだ絞り込み(null = 全題材 / 全層) */
  subject_id: subjectIdSchema.nullable(),
  layer: layerSchema.nullable(),
  card_results: z.array(cardResultSchema),
});
export type SessionLog = z.infer<typeof sessionLogSchema>;

// ── ユーザー設定 ──────────────────────────────────────────────────────

export const THEMES = ["system", "dark", "light"] as const;
export const themeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof themeSchema>;

/** 1 セッションの枚数。約 20 秒/枚 × 枚数が 3〜7 分に収まる範囲 */
export const SESSION_SIZES = [8, 12, 16, 20] as const;
export const DEFAULT_SESSION_SIZE = 12;

/** 学習の目的: general = 題材横断のベースコース / subject = 特定の題材に集中 */
export const LEARNING_GOALS = ["general", "subject"] as const;
export const learningGoalSchema = z.enum(LEARNING_GOALS);
export type LearningGoal = z.infer<typeof learningGoalSchema>;

export const userSettingsSchema = z.object({
  user_id: z.uuid(),
  session_size: z.number().int().min(8).max(20),
  theme: themeSchema,
  learning_goal: learningGoalSchema,
  focus_subject_id: subjectIdSchema.nullable(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

// ── 間違い報告 ────────────────────────────────────────────────────────

export const cardReportSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  card_id: z.uuid(),
  reason: z.string().min(1).max(1000),
  created_at: isoDateTime,
});
export type CardReport = z.infer<typeof cardReportSchema>;
