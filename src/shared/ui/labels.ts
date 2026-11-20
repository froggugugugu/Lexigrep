import type {
  KNOWN_SUBJECT_CATEGORIES,
  Layer,
  QuestionType,
  Subject,
} from "@/shared/content/schema";

type KnownSubjectCategory = (typeof KNOWN_SUBJECT_CATEGORIES)[number];

export const LAYER_LABELS: Record<Layer, string> = {
  vocab: "頻出単語",
  pattern: "表現パターン",
  idiom: "慣用句・定型句",
  system_term: "題材特有語",
};

const KNOWN_CATEGORY_LABELS: Record<KnownSubjectCategory, string> = {
  genai: "生成AI",
  language_fw: "言語/FW",
  cloud: "クラウド",
  idp: "IdP",
  testing: "テスト",
};

/** カテゴリの表示名: 題材の指定 → 既知の表示名 → 値そのもの */
export function categoryLabel(
  subject: Pick<Subject, "category" | "category_label">,
): string {
  if (subject.category_label) return subject.category_label;
  // "constructor" などプロトタイプ上の名前を表示名として拾わない
  return Object.hasOwn(KNOWN_CATEGORY_LABELS, subject.category)
    ? KNOWN_CATEGORY_LABELS[subject.category as KnownSubjectCategory]
    : subject.category;
}

export const QUESTION_PROMPTS: Record<QuestionType, string> = {
  choose_meaning: "ハイライト部分の意味は?",
  fill_blank: "空欄に入る語句は?",
  recognize_pattern: "同じパターンの文はどれ?",
  next_action: "この文を読んだら、次にすることは?",
};
