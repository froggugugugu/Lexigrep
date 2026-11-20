/**
 * 投入計画(純粋関数)。DB の既存カードとパッケージの差分から、何を upsert / retire / delete するかを決める。
 * - パッケージに無いカード: draft なら削除(レビュー前なので履歴もない)、それ以外は retired に(学習履歴は残す)
 * - パッケージが 0 枚なら全件 retire になってしまうため中断する
 */
import type { Card, CardStatus } from "../../src/shared/content/schema";

export type ExistingCardRow = {
  id: string;
  status: CardStatus;
  reviewed_by: string | null;
};

export type ImportPlan = {
  upsert: Card[];
  retire: string[];
  delete: string[];
};

export function planImport(
  existing: readonly ExistingCardRow[],
  packageCards: readonly Card[],
): ImportPlan {
  if (packageCards.length === 0) {
    throw new Error(
      "パッケージのカードが 0 枚です。全件 retire を防ぐため中断します",
    );
  }
  const packageIds = new Set(packageCards.map((c) => c.id));
  const retire: string[] = [];
  const del: string[] = [];
  for (const row of existing) {
    if (packageIds.has(row.id)) continue;
    if (row.status === "retired") continue;
    if (row.status === "draft" || row.reviewed_by === null) del.push(row.id);
    else retire.push(row.id);
  }
  return { upsert: [...packageCards], retire, delete: del };
}

/** 出典の差し替え計画: 新しい出典を upsert した後に、不要になった (card_id, url) だけを削除する */
export function planSourceDeletes(
  existing: readonly { card_id: string; url: string }[],
  next: readonly { card_id: string; url: string }[],
): { card_id: string; url: string }[] {
  const keep = new Set(next.map((s) => `${s.card_id}\u0000${s.url}`));
  return existing.filter((s) => !keep.has(`${s.card_id}\u0000${s.url}`));
}
