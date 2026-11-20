import type { Card, Layer } from "@/shared/content/schema";

/** クライアントへ渡す 1 カード分(選択肢の表示順を含む) */
export type SessionCard = {
  card: Card;
  /** choices.options のインデックスの表示順 */
  optionOrder: number[];
};

export type SessionPayload = {
  cards: SessionCard[];
  startedAt: string;
  filter: { subjectId: string | null; layer: Layer | null };
  dueCount: number;
  newCount: number;
  estimatedMinutes: number;
};
